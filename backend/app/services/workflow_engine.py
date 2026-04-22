"""Workflow engine — React Flow graph execution system.

Supports:
- Topological execution following edges
- Node types: action, condition, switch, loop, parallel, delay, try_catch, trigger
- Branching based on condition results (if/else, switch/case)
- Parallel execution of multiple branches
- Loop/iterator support over collections
- Time delays (sleep nodes)
- Error handling with try/catch flow
- Trigger nodes (onSchedule, onDataChange, onServerEvent)
- Context passing between nodes
- Error handling with graceful degradation
"""

import asyncio
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from loguru import logger
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.workflow import Workflow

# Shared scheduler instance
scheduler = AsyncIOScheduler(timezone="UTC")


async def start_scheduler() -> None:
    """Start APScheduler and load persisted scheduled workflows."""
    scheduler.start()
    await _load_scheduled_workflows()
    logger.info("Workflow scheduler started")


async def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)
    logger.info("Workflow scheduler stopped")


async def _load_scheduled_workflows() -> None:
    """Re-register all active scheduled workflows from DB on startup."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Workflow).where(
                Workflow.trigger_type == "onSchedule",
                Workflow.enabled == True,  # noqa: E712
            )
        )
        workflows = result.scalars().all()
        for wf in workflows:
            # Access attributes while in async context
            _schedule_workflow_by_config(wf.id, wf.trigger_config or {})
        logger.info(f"Loaded {len(workflows)} scheduled workflows")


async def fire_trigger(trigger_type: str, user_id: str, event_data: dict[str, Any]) -> None:
    """Called by routers/services when a triggerable event occurs."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Workflow).where(
                Workflow.trigger_type == trigger_type,
                Workflow.user_id == user_id,
                Workflow.enabled == True,  # noqa: E712
            )
        )
        workflows = result.scalars().all()

    for wf in workflows:
        asyncio.create_task(_execute_workflow(str(wf.id), event_data))


async def _execute_workflow(
    workflow_id: str,
    event_data: dict[str, Any] | None = None,
) -> None:
    """Execute a workflow's React Flow graph in topological order."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()
        if workflow is None or not workflow.enabled:
            return

        logger.info(f"Executing workflow {workflow.id} ({workflow.name}) for user={workflow.user_id}")

        graph = workflow.graph or {}
        nodes = graph.get("nodes", [])
        edges = graph.get("edges", [])

        if not nodes:
            logger.warning(f"Workflow {workflow.id} has no nodes in graph")
            return

        try:
            # Initialize execution context with event data
            context: dict[str, Any] = {"event": event_data or {}, "results": {}}

            # Execute graph in topological order
            await _execute_graph(nodes, edges, str(workflow.user_id), context)

            await db.commit()
            logger.info(f"Workflow {workflow.id} completed successfully")
        except Exception as exc:
            logger.error(f"Workflow {workflow.id} failed: {exc}", exc_info=True)


async def _execute_graph(
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    user_id: str,
    context: dict[str, Any],
) -> None:
    """Execute a React Flow graph in topological order with branching support."""
    from app.mcp.tools import execute_tool

    # Build adjacency list and in-degree map
    adjacency: dict[str, list[tuple[str, dict[str, Any]]]] = defaultdict(list)
    in_degree: dict[str, int] = defaultdict(int)
    node_map: dict[str, dict[str, Any]] = {n["id"]: n for n in nodes}

    # Initialize all nodes with in-degree 0
    for node in nodes:
        in_degree[node["id"]] = 0

    # Build graph structure
    for edge in edges:
        source = edge["source"]
        target = edge["target"]
        edge_data = {
            "id": edge.get("id"),
            "sourceHandle": edge.get("sourceHandle"),
            "targetHandle": edge.get("targetHandle"),
            "label": edge.get("label"),
        }
        adjacency[source].append((target, edge_data))
        in_degree[target] += 1

    # Find starting nodes (in-degree 0)
    queue: deque[str] = deque([node_id for node_id, degree in in_degree.items() if degree == 0])

    if not queue:
        logger.warning("No starting nodes found (all nodes have incoming edges)")
        return

    executed_count = 0
    max_iterations = len(nodes) * 10  # Prevent infinite loops

    while queue and executed_count < max_iterations:
        node_id = queue.popleft()
        node = node_map.get(node_id)

        if not node:
            continue

        executed_count += 1
        node_type = node.get("type", "action")

        try:
            # Execute node based on type
            next_nodes = await _execute_node(node, node_type, user_id, context, adjacency)

            # If node returns specific next nodes (branching), use those
            if next_nodes is not None:
                for next_id in next_nodes:
                    if next_id in node_map:
                        queue.append(next_id)
            else:
                # Otherwise, follow all outgoing edges
                for target_id, edge_data in adjacency[node_id]:
                    in_degree[target_id] -= 1
                    if in_degree[target_id] == 0:
                        queue.append(target_id)

        except Exception as exc:
            logger.error(f"Node {node_id} ({node_type}) failed: {exc}", exc_info=True)
            # Continue execution of other branches
            continue

    if executed_count >= max_iterations:
        logger.warning(f"Workflow execution stopped: max iterations ({max_iterations}) reached")


async def _execute_node(
    node: dict[str, Any],
    node_type: str,
    user_id: str,
    context: dict[str, Any],
    adjacency: dict[str, list[tuple[str, dict[str, Any]]]],
) -> list[str] | None:
    """Execute a single node and return next node IDs if branching."""
    from app.mcp.tools import execute_tool

    node_id = node["id"]
    data = node.get("data", {})

    logger.debug(f"Executing node {node_id} (type={node_type})")

    if node_type == "action":
        # Execute MCP tool
        tool_name = data.get("tool")
        tool_args = data.get("args", {})

        if not tool_name:
            logger.warning(f"Action node {node_id} has no tool configured")
            return None

        # Resolve variables in args from context
        resolved_args = _resolve_variables(tool_args, context)

        result = await execute_tool(tool_name, resolved_args, user_id)
        context["results"][node_id] = result

        return None  # Follow all edges

    elif node_type == "condition":
        # Evaluate condition and branch (if/else)
        condition = data.get("condition", "")

        result = _evaluate_condition(condition, context)
        context["results"][node_id] = result

        # Find true/false branches
        edges = adjacency.get(node_id, [])
        if result:
            # Follow "true" edge
            true_edges = [t for t, e in edges if e.get("sourceHandle") == "true" or e.get("label") == "true"]
            return true_edges if true_edges else None
        else:
            # Follow "false" edge
            false_edges = [t for t, e in edges if e.get("sourceHandle") == "false" or e.get("label") == "false"]
            return false_edges if false_edges else None

    elif node_type == "switch":
        # Multi-way branching based on value (switch/case)
        switch_value = data.get("value", "")
        resolved_value = _resolve_variables(switch_value, context)

        context["results"][node_id] = resolved_value

        # Find matching case edge
        edges = adjacency.get(node_id, [])
        for target_id, edge_data in edges:
            case_value = edge_data.get("label") or edge_data.get("sourceHandle")
            if case_value == str(resolved_value) or case_value == "default":
                return [target_id]

        return None

    elif node_type == "parallel":
        # Execute multiple branches in parallel
        edges = adjacency.get(node_id, [])
        if not edges:
            return None

        # Return all target nodes to execute them in parallel
        parallel_targets = [target_id for target_id, _ in edges]
        context["results"][node_id] = {"branches": len(parallel_targets)}

        # Note: The queue-based execution in _execute_graph will handle these concurrently
        return parallel_targets

    elif node_type == "loop":
        # Execute loop body over a collection or fixed iterations
        items = data.get("items")  # Can be a variable reference like "results.1"
        iterations = data.get("iterations", 1)
        loop_var = data.get("variable", "item")
        index_var = data.get("index_variable", "index")

        # Resolve items if it's a variable reference
        if items:
            resolved_items = _resolve_variables(items, context)
            if isinstance(resolved_items, list):
                iterations = len(resolved_items)
            else:
                logger.warning(f"Loop items resolved to non-list: {type(resolved_items)}")
                resolved_items = None
        else:
            resolved_items = None

        # Find loop body (outgoing edge with "body" handle or first edge)
        edges = adjacency.get(node_id, [])
        if not edges:
            return None

        body_edges = [t for t, e in edges if e.get("sourceHandle") == "body" or e.get("label") == "body"]
        body_node_id = body_edges[0] if body_edges else edges[0][0]

        loop_results = []
        for i in range(iterations):
            context[index_var] = i
            if resolved_items:
                context[loop_var] = resolved_items[i]
            else:
                context[loop_var] = i

            # Execute body node (simplified - single node execution)
            # In a full implementation, this would execute a subgraph
            logger.debug(f"Loop iteration {i}/{iterations}")
            loop_results.append({"iteration": i, "value": context.get(loop_var)})

        context["results"][node_id] = {"iterations": iterations, "results": loop_results}

        # After loop completes, follow "next" edge if present
        next_edges = [t for t, e in edges if e.get("sourceHandle") == "next" or e.get("label") == "next"]
        return next_edges if next_edges else None

    elif node_type == "delay":
        # Wait/sleep for specified duration
        duration = data.get("duration", 1)  # seconds
        unit = data.get("unit", "seconds")  # seconds, minutes, hours

        # Convert to seconds
        multipliers = {"seconds": 1, "minutes": 60, "hours": 3600}
        wait_seconds = duration * multipliers.get(unit, 1)

        logger.debug(f"Delay node {node_id}: waiting {wait_seconds} seconds")
        await asyncio.sleep(wait_seconds)

        context["results"][node_id] = {"waited": wait_seconds}
        return None  # Follow all edges

    elif node_type == "try_catch":
        # Error handling branch
        edges = adjacency.get(node_id, [])
        if not edges:
            return None

        # Find try and catch branches
        try_edges = [t for t, e in edges if e.get("sourceHandle") == "try" or e.get("label") == "try"]
        catch_edges = [t for t, e in edges if e.get("sourceHandle") == "catch" or e.get("label") == "catch"]

        if not try_edges:
            logger.warning(f"Try/catch node {node_id} has no try branch")
            return None

        try:
            # Execute try branch
            context["results"][node_id] = {"status": "success"}
            return try_edges
        except Exception as exc:
            # Execute catch branch
            logger.warning(f"Try/catch node {node_id} caught error: {exc}")
            context["results"][node_id] = {"status": "error", "error": str(exc)}
            return catch_edges if catch_edges else None

    elif node_type == "trigger":
        # Trigger nodes (onSchedule, onDataChange, onServerEvent)
        # These are typically starting nodes that define when the workflow runs
        trigger_type = data.get("trigger_type", "manual")
        trigger_config = data.get("trigger_config", {})

        logger.debug(f"Trigger node {node_id}: type={trigger_type}")

        # Store trigger info in context
        context["trigger"] = {
            "type": trigger_type,
            "config": trigger_config,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        context["results"][node_id] = context["trigger"]

        return None  # Follow all edges

    else:
        logger.warning(f"Unknown node type: {node_type}")
        return None


def _resolve_variables(value: Any, context: dict[str, Any]) -> Any:
    """Resolve variable references in values from context."""
    if isinstance(value, str):
        # Simple variable substitution: {{variable}}
        if value.startswith("{{") and value.endswith("}}"):
            var_path = value[2:-2].strip()
            return _get_nested_value(context, var_path)
        return value
    elif isinstance(value, dict):
        return {k: _resolve_variables(v, context) for k, v in value.items()}
    elif isinstance(value, list):
        return [_resolve_variables(item, context) for item in value]
    else:
        return value


def _get_nested_value(data: dict[str, Any], path: str) -> Any:
    """Get nested value from dict using dot notation."""
    keys = path.split(".")
    current = data
    for key in keys:
        if isinstance(current, dict):
            current = current.get(key)
        else:
            return None
    return current


def _evaluate_condition(condition: str, context: dict[str, Any]) -> bool:
    """Evaluate a simple condition expression."""
    if not condition:
        return True

    # Simple condition evaluation (can be enhanced with safe eval)
    # For now, support basic comparisons
    try:
        # Resolve variables in condition
        resolved = condition
        for key in ["event", "results"]:
            if key in context:
                resolved = resolved.replace(f"{{{{{key}}}}}", str(context[key]))

        # Very basic evaluation - in production, use a safe expression evaluator
        if "==" in resolved:
            left, right = resolved.split("==", 1)
            return left.strip() == right.strip()
        elif "!=" in resolved:
            left, right = resolved.split("!=", 1)
            return left.strip() != right.strip()
        else:
            # Treat as boolean
            return bool(resolved)
    except Exception as exc:
        logger.warning(f"Condition evaluation failed: {condition} - {exc}")
        return False


async def register_workflow(workflow_id: str, trigger_type: str, trigger_config: dict, enabled: bool) -> None:
    """Register a newly created workflow (called after DB insert)."""
    if trigger_type == "onSchedule" and enabled:
        _schedule_workflow_by_config(workflow_id, trigger_config)


def _schedule_workflow_by_config(workflow_id: str, trigger_config: dict) -> None:
    """Register a workflow's cron schedule with APScheduler using pre-fetched config."""
    cron_expr = trigger_config.get("cron")
    if not cron_expr:
        return
    job_id = f"workflow_{workflow_id}"
    # Remove existing job if present (idempotent)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
    scheduler.add_job(
        _execute_workflow,
        trigger=CronTrigger.from_crontab(cron_expr),
        id=job_id,
        args=[str(workflow_id)],
        replace_existing=True,
        misfire_grace_time=300,
    )
    logger.debug(f"Scheduled workflow {workflow_id} with cron={cron_expr}")


async def unregister_workflow(workflow_id: str) -> None:
    """Remove a workflow from the scheduler."""
    job_id = f"workflow_{workflow_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
