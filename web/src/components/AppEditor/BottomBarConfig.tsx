import { useMemo } from 'react';
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';
import type { BottomBarSlot, ModuleInstance } from '../../stores/useAppEditorStore';

interface BottomBarConfigProps {
  slots: BottomBarSlot[];
  availableModules: ModuleInstance[];
  onUpdateSlots: (slots: BottomBarSlot[]) => void;
  onRemoveSlot: (slotPosition: number) => void;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}

interface SortableSlotProps {
  slot: BottomBarSlot;
  index: number;
  onRemove: () => void;
}

function SortableSlot({ slot, index, onRemove }: SortableSlotProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slot.module_instance_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <GripVertical size={16} />
      </button>
      <div className="flex-1 flex items-center gap-2">
        <span className="text-lg">{slot.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-900 truncate">{slot.name}</div>
          <div className="text-xs text-gray-500">Slot {index + 1}</div>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
        title="Remove from bottom bar"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function BottomBarConfig({
  slots,
  availableModules,
  onUpdateSlots,
  onRemoveSlot,
  isDragging,
  onDragStart,
  onDragEnd,
}: BottomBarConfigProps) {
  const sortedSlots = useMemo(() => {
    return [...slots].sort((a, b) => a.slot_position - b.slot_position);
  }, [slots]);

  const slotIds = useMemo(() => sortedSlots.map(s => s.module_instance_id), [sortedSlots]);

  const handleDragStart = (event: DragStartEvent) => {
    onDragStart();
  };

  const handleDragEnd = (event: DragEndEvent) => {
    onDragEnd();
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = sortedSlots.findIndex(s => s.module_instance_id === active.id);
    const newIndex = sortedSlots.findIndex(s => s.module_instance_id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reordered = [...sortedSlots];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    // Update slot_position to match new order
    const updated = reordered.map((slot, index) => ({
      ...slot,
      slot_position: index,
    }));

    onUpdateSlots(updated);
  };

  const canAddMore = slots.length < 5;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Bottom Bar (5 slots max)</h3>
        <span className="text-xs text-gray-500">{slots.length}/5 slots used</span>
      </div>

      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={slotIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {sortedSlots.map((slot, index) => (
              <SortableSlot
                key={slot.module_instance_id}
                slot={slot}
                index={index}
                onRemove={() => onRemoveSlot(slot.slot_position)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {slots.length === 0 && (
        <div className="px-4 py-8 border-2 border-dashed border-gray-200 rounded-lg text-center">
          <p className="text-sm text-gray-500">No modules in bottom bar</p>
          <p className="text-xs text-gray-400 mt-1">Add modules from the launchpad below</p>
        </div>
      )}

      {!canAddMore && (
        <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700">
            Bottom bar is full (5 slots). Remove a module to add another.
          </p>
        </div>
      )}
    </div>
  );
}
