# Feature Feedback 4

I saw a lot of junk from testing. When you are testing, please remmeber to remove them or recover them to a previous state that is perfectly functinal. Fo rexample There are a billion “Test apps” or “new apps” throughout the app editor. I don’t need that. I need the main template (sample).

# Helm Admin

## App Editor

The overall UI is not displaying properly there are many issues with icons throughout. The invidividual modules don’t have proper settings for setting their icons (I cannot set the icons for Home, chat, etc. etc.). They are just blank space. 

There are no push to sync. I think none of the app editor settings are implemented directly to the frontend. When i click save or do anything it doesn’t show up as change. The architecture should be something similar to there is always a JSON that is serving from the backend. The helm admin is just a way to modify this JSOn that is being served to the frontend and the frontend editing from there. But right now there are no way to make the push to the backend.

I’m also not really satisfied with the mobile UI right now. I think it can be simplified, there is no need to have 2 side bars on each side. Just the main phone section. In the phone section, there should be 2 parts. First is the center of the screen and the bottom of the screen. The center of the screen should basically be the preview of the launch pad. And on the bottom of the screen there should be just things you can drag down. This screen should look exactly like what it is on mobile when you click launch pad. In the center of the screen, each module should just appear as an icon, and you can click and drag an icon to the bottom bar to let it appear there. Basically it should look exactly like an iPhone, the center part would be all the apps, and then you have the bottom bar. There should be 1 more side bar for some module specific settings you can set there. 

Most htings here are still not functional. Live testing is not done correctly to make sure these parts are functional. Dark mode for sure not work, it doesn’t even sync back to the mobile side of things.

## Visual Editor

Let’s talk about this in general. Starting with just the general interface of the visual editor. I actually want you to tweak the naming a bit. App Editor and Visual editor is kind of confusing. It should just be module editor and app editor so chnage the naming there. 

The sidebar structure thing is working great so far. I like how it is collapsible. 

One thing to mention is that the top bar is still a bit awkward with the “draft v1” “approve” “reject” system. This is mentioned later in the overall delivery and verisioning model.

I also noticed something about the saving system. Right now I cannot create a new module and save it as a separate. The “save” button is greyed out when I click new module and try to edit stuff. 

App Preview like mentioned before needs complete rework. It should be closer to rendering the exact React Native app directly in web admin instead  of creating something new and simulating it.

I also tried right clicking on the module, that doesn’t work, it pops up something completely blank. Nothing in it. I cannot delete the module or anything just completely blank. 

Some of the templates are still using non existent components go fix that too. 

### Rows

Previously I requested that there is the drag handler (6 do thing) to be visible but now it’s not. It should be on the left side of the row. (Not within the  row, but to the left of it, not within the screen). This should support smooth dragging actions and no lagging behind. So I can change the order of the rows easily. 

I can increase the size of the rows but it’s laggy. The size of the row drags behind a bit. It’s not fully following my mouse. 

When I add cells I can add more than 6 now, which is good, but the minimum-size and width rules are still not correctly enforced. The full rule should be implemented like this:

**Cell width calculation rule**

Cells should be calculated as percentages of the row width, not vague flex numbers and not raw pixels. The default width for a new cell should be **auto**.

Formula:

```
fixedTotal = sum(width % of all manually-sized cells)
remaining = 100% - fixedTotal
autoCellWidth = remaining / numberOfAutoCells
```

Example:

```
Cell 1 = 50%
Cell 2 = auto
Cell 3 = auto

remaining = 100% - 50% = 50%
autoCellWidth = 50% / 2 = 25%

Final row = 50% / 25% / 25%
```

**Minimum width rule**

Every cell must have a minimum width. The editor should resolve the final widths first, then check that every resolved cell is still above the minimum width. This should be based on the usable row content width, not the raw outside row width.

Formula:

```
usableRowWidth = rowWidth - horizontalPadding - gaps
minWidthPercent = minCellWidthPx / usableRowWidthPx * 100
```

Validation:

```
resolvedCellWidthPercent >= minWidthPercent
```

This means padding and gaps are part of the calculation. If the user increases padding so much that cells cannot fit their minimum width anymore, the editor should block the padding change.

**Action blocking rules**

The editor should block any user action before it commits if that action would make the row invalid. Do not apply the change first and then let the row break visually.

**Pre-flight next-action check**

The editor should not only validate after the user attempts an action. It should continuously check whether the **next possible action** is valid before the user clicks it. If the next action would break the row rules, that control should already be disabled / greyed out, and the UI should explain why.

Examples:

- If adding one more cell would make any cell smaller than the minimum width, the **Add Cell** button should be greyed out and disabled.
- If increasing a fixed cell width would make `fixedTotal > 100%`, the width increase should be blocked before it applies.
- If increasing a fixed cell width would make remaining auto cells smaller than the minimum width, that new value should not be accepted.
- If increasing padding would reduce usable row width so much that cells cannot fit their minimum width, the increase-padding button/control should be greyed out.
- If decreasing row width would make the current cells impossible to fit, the resize handle should stop at the minimum valid point instead of letting the row break.
- If turning off horizontal scrolling would make the current cells overflow or violate minimum width, the toggle should be disabled or show a confirmation/error explaining that the row must be fixed first.

The important behavior is: the editor should predict invalid states and prevent the user from entering them. The user should see a clear reason like "Cannot add another cell: minimum cell width would be violated" or "Cannot increase padding: cells have reached minimum width."

Block adding a new cell when the new auto width would fall below the minimum:

```
newAutoWidth = (100% - fixedTotal) / newAutoCellCount

if newAutoWidth < minWidth:
	block add-cell action
```

Block changing a manual cell width when the fixed-width total would exceed 100%:

```
if fixedTotal > 100%:
	block width change
```

Block changing a manual cell width when the remaining auto cells would become smaller than the minimum:

```
remaining = 100% - fixedTotal
autoWidth = remaining / autoCellCount

if autoWidth < minWidth:
	block width change
```

Block resizing the row smaller, increasing horizontal padding, increasing gaps, or changing any layout setting when the usable row width can no longer fit all cells at their minimum width:

```
if usableRowWidth cannot fit all cells at min width:
	block resize / padding / gap / layout change
```

**Horizontal scrolling rule**

If horizontal scrolling is turned off, the row must not silently turn scrolling on. The editor also must not allow cells to overflow outside the row. If a change would require scrolling or overflow to fit, and scrolling is disabled, block the action and show a clear warning.

If horizontal scrolling is turned on, then the row can allow more cells than would normally fit, but the minimum width still applies. Scrolling is not a way to shrink cells below their minimum width.

**All fixed-width cells rule**

If all cells have fixed widths and their total is less than 100%, the cells should not stretch to fill the remaining space. Instead, the row should center the cells and treat the leftover space as side padding.

Example:

```
Cell 1 = 30%
Cell 2 = 30%

fixedTotal = 60%
leftover = 40%

Final behavior:
20% empty space left
30% cell
30% cell
20% empty space right
```

**Mixed fixed + auto rule**

If at least one cell is auto, then all leftover width after fixed cells should go to the auto cells. In this case, leftover width should not become side padding. It only becomes side padding when **all** cells are fixed-width and fixedTotal is below 100%.

**Validation timing**

This validation needs to run for every relevant operation:

- adding a cell
- deleting a cell
- changing a cell from auto to fixed
- changing a cell from fixed to auto
- typing a width in the config panel
- dragging a cell divider
- resizing the row
- changing row padding
- changing row gaps
- toggling horizontal scrolling
- loading an existing saved row
- importing/applying a template

If an existing saved row or template violates these rules, the editor should show a validation error and refuse to publish it until fixed. It should not silently normalize it into a different layout.

Right now I see the cells actually fitting to the resizes of the rows (stretches) which is intended but I also notice that the components or atomic components are not fitting. You need to do this (VERY IMPORTANT) which is fit everything thing. If the cell is 80px * 80px then creating the button should fit that entire thing. Button doesn’t need to be resized because of this. Input bars too. Everything. 

I have no idea currently if the bottom divider works or not because right now preview app is completely broken and needs full rewrite. 

You know what I think we need to start simplifying. Remove all space related features completely for rows (padding, gap). They are not needed and just cause too much problems. I think I will also say remove any color related settings in the rows (no background colors). Makes it too complicated with cells. 

Also for the minimum widths and heights (all of these “type” enforcmenets), instead of letting it happen and resetting it to the minimum to stop the issue, why not just make it so that you can’t drag it to below the minimum requirements. For example the height, i can actually drag it to below 48px but then it bounces back to 48px. Just make it so that you can’t drag it at all to have less bugs and have it more clean. 

### Cells

Cells resizing is also extremely weird. It’s not following the cursor and it moves other cells when moving this cell. Make sure this also follows the minimum width rule. 

In addition, the “x” that deleted the cell of the right most cell is overlapping with the row’s “x”. So move the row’s “x” to the left and cells are on the left.

### Variable system

This thing is complicated and it’s through many many systems. The main idea right now is that it doesn’t show up and it doesn’t actually get displayed and preview. I can add the pill UI now with @ and it works quite well but when it gets pasted in it’s a bit weird now. Like the “hit box” of it is quite big and I can accidentally click on it even though im not actually selecting it. The main problem is still it doesn’t work at all. This needs to be tested with a better QA script. 

### Text

This thing is working except for the fact that variable system is broken. 

To simplify, I want you to remove this component completely and we prioritze on getting the markdown working. So instead of having text and markdown, remove the current text and then make Markdown named as “text”.  

### Markdowns

Markdown has a weird bug. The enter key just doesn’t work. Like on the config panel on the right when I type something. It shows up on the “”preview” thing normally right? But when I hit “enter” and then continue typing, they all show on the same line. 

Since we are removing “text” completely, add 1 single feature that I care about which is the left, center, and mid align. Everything we will jsut use native markdown for everything. Also make sure the variable system works in this case. For all the templates, make sure these migrations are done. 

### Buttons

Buttons should fit the entire cell under all circumstances. There wouldn’t be any size difference for the buttons. In addition, the icon mode is just completely broken. Nothing shows up on the icon part. I’m not going to actually test out the actions to see if they are work because too much of a hassle to setup. This is why we need templates. (Check previous feature feedback for more information you will understand, template first architecture). 

### Image

I think this is the only one that we don’t emphasize the fit the cell. Instead it will just have preference of width fitting or height fitting (fit base on height or fit base on width). Just make sure this works. Also remove all these properties. (Alt text, width, height, aspect ratio (this will just be the image’s original aspect ratio), border radius, resize mode (fit mode or soemthing), action). 

### Text input

You know what I think this can be push back. Instead of having this, the input bar is probably enough. remove this. We will just have input bar instead of this text input bar. 

### Icons

Icons are completely broken. I can’t change icons at all or anything. For humans there should be a popup for emojis but now it’s for this. Also it should be the same and fit the cell instead of be in the corner. 

### Empty container

All of the empty container feature is not implemented. Remove “gap” and “padding” and “background”. Then do this:

**Empty Container design choice**

- Empty Container is just a **vertical row**.
- Everything should be inherited from the existing Row system, but rotated vertically:
    - Row cells become vertical sub-cells.
    - Row add/delete/reorder behavior becomes vertical add/delete/reorder behavior.
    - Row minimum-size and validation rules become vertical minimum-height and validation rules.
    - Row drag behavior becomes vertical drag behavior.
    - Row component-fitting rules still apply.
- Do not build a separate complicated layout system for this.
- Do not expose fake/internal `Container` components. Empty Container must be a real editable component.
- Since it is just a vertical row, remove extra styling/settings from it: no `gap`, no `padding`, no `background`.
- The Daily Planner test case should be: one normal row → one cell → one Empty Container vertical row → Calendar / Todo / Notes stacked vertically.

### Calendar

The calendar is not complete at all. I don’t see any part of it done. It’s very barebones right now. They also don’t fit the cell but it should. 

The Calendar Component should be a real functional component, not a fake/static template element. This section restores the full Calendar idea from the previous brainstorm and updates it for the current simplified editor direction. 

**Calendar Component — full implementation direction**

Calendar should be one first-class Component with an admin-controlled `variant` setting. Do not create a bunch of separate fake calendar components. The admin/module editor chooses which version of the Calendar appears in a module, and the frontend renders that exact variant.

**Supported variants**

- **Month** — full month grid.
- **Week** — week time-block view.
- **Day** — day time-block view.
- **Event List** — no grid; just upcoming events in a vertical list.
- **Compact** — small dashboard/widget version that fits inside a small cell.

**Variant control rule**

- Variant switching is admin-controlled only.
- The mobile user should not see Month / Week / Day / List / Compact switcher buttons.
- The mobile user can still navigate time inside the chosen variant.
- Example: if the admin chooses Week, the user can go to next week / previous week / today, but cannot switch the component into Month view from the mobile UI.

**Date navigation rule**

Every date-based variant should keep a small built-in navigation header:

```
◀  [Current range label]  ▶    [Today]
```

Examples:

- Month: `◀ May 2026 ▶ [Today]`
- Week: `◀ May 11–17 ▶ [Today]`
- Day: `◀ Wed May 13 ▶ [Today]`

This date navigation should be part of the Calendar Component itself, not something the user has to build manually with buttons.

**Fit-the-cell requirement**

The Calendar must respect the current cell size. The current problem is that the calendar is basically only a huge month grid, so it cannot work inside dashboard rows or smaller cells. The new component must be layout-aware:

- If the Calendar is in a small cell, use Compact or Event List.
- Compact should show only the most useful summary: event count, next event, maybe the next few events.
- Month/Week/Day can require more space, but they still must not overflow the row/cell.
- The component should not silently break the layout or force cells outside row boundaries.
- If the selected variant cannot fit the current cell, the editor should show a validation warning/error before publish.

**Month variant — full behavior**

Month view should be similar to Apple Calendar / Notion Calendar:

- 7-column month grid.
- Today highlighted.
- Each date is clickable/tappable.
- Days with events show colored dots or small indicators.
- Color indicates event source/calendar.
- Phone behavior: tapping a date populates the lower part of the component with that day’s agenda list.
- Tablet/wide-screen behavior: show event pills directly inside day cells when there is enough space, closer to Notion Calendar desktop behavior.
- Tapping an event opens event details.

**Week / Day variants — time-block behavior**

Week and Day views should use a time-block grid:

- Vertical axis = time from 00:00 to 23:59.
- Events appear as positioned blocks based on start/end time.
- Overlapping events should be handled cleanly, either side-by-side or stacked.
- Current time indicator should be supported if easy.
- User can swipe or use arrows to move through dates.
- Tapping an event opens event details.

**3-day view idea**

Earlier brainstorm also included a 3-day time-block view:

- X-axis = 3 dates.
- Y-axis = 00:00–23:59.
- Events are colored blocks in the correct time slots.
- User can swipe to move the 3-day window.
- Tapping an event opens the details.

This can be implemented either as:

- a separate `ThreeDay` variant later, or
- a configurable Week/Day mode if the implementation library supports it cleanly.

Do not overcomplicate V1 if the existing variant list is enough, but keep the 3-day idea in mind because it was part of the original intended Calendar UX.

**Event List variant**

Event List is for cases where a grid is too much:

- Vertical list of upcoming events.
- Each row shows event title, time, date if not today, source color, and optional metadata.
- Good for small/medium cells and dashboard views.
- Should support filters such as only showing certain event types/categories.

**Compact variant**

Compact is specifically for dashboard cells:

- It should fit in a 50/50 dashboard row.
- Example content:

```
📅 3 events today
Next: 2:00 PM — Team sync
```

- It should not render a full month grid.
- It should be useful at a glance.
- This is the variant used in the Personal Dashboard template next to Weather.

**Event detail behavior**

When the user taps an event, show a detail surface. Since current product direction removes modals/bottom sheets, use full-screen navigation or an inline detail panel depending on the variant/screen size.

For normal calendar events, show:

- Title
- Start/end time
- All-day status
- Calendar/source name
- Source color
- Location if available
- Description/notes if available
- Reminder info if available

For Notion-backed events, show a richer Notion-style property card:

- Title
- Date/time range
- Reminder time
- Status
- Tags
- Custom properties
- Notes/content
- Link back to the original Notion page if available

The long-term vision is basically: make the Notion Calendar experience actually good on mobile/iPad, including Notion database properties and page context.

**Unified event data model**

The frontend should not care where events come from. It should receive a unified event array from the backend/local data layer.

Suggested event shape:

```json
{
  "id": "event-id",
  "title": "Event title",
  "start": "2026-05-13T14:00:00+08:00",
  "end": "2026-05-13T15:00:00+08:00",
  "allDay": false,
  "sourceId": "source-id",
  "sourceName": "Google Calendar / Notion / Local",
  "sourceType": "local | caldav | notion | custom",
  "sourceColor": "#4F7CFF",
  "properties": {}
}
```

The `properties` object is flexible so Notion events can include page/database properties without forcing the normal calendar event schema to become messy.

**Local-first data rule**

Calendar should follow the same local-first architecture as the rest of Helm:

- Local SQLite event table works first.
- Remote connections are optional and sync into the local representation.
- Calendar UI reads from the local/unified event model.
- Remote source sync is handled by a connector/sync layer, not by the Calendar component directly.

**Sources to support over time**

- Local events first.
- CalDAV later for Google Calendar, iCloud, Fastmail, Nextcloud, etc.
- Notion database/page date properties later.
- Custom API sources later.

**Color rule**

- Each source/calendar gets an auto-assigned color for MVP.
- User-customizable colors are deferred QoL.
- Color must stay consistent across Month dots, Week/Day blocks, Event List rows, and event detail headers.

**Filtering**

Admin should be able to configure what the Calendar shows:

- all events
- only selected sources/calendars
- only selected event categories/types
- possibly only events matching certain properties later

This is especially important for using Calendar inside templates. Example: a compact dashboard calendar might show only today’s school/project events, while a full Calendar module shows everything.

**Data binding requirement**

The Calendar must be tested with real data binding. Do not ship a visually working calendar that only uses static/mock data.

Minimum tests:

- Calendar renders events from local data.
- Compact variant shows correct event count and next event.
- Event List shows upcoming events in correct order.
- Month view shows indicators on correct dates.
- Week/Day view positions events correctly by time.
- Date navigation changes the visible range.
- Event detail opens and displays correct fields.
- Source colors are consistent.

**Recommended implementation libraries**

Earlier research suggested:

- `react-native-calendars` for Month grid because it supports dot marking and day press behavior well.
- `react-native-big-calendar` for Day/Week/3-day time-block layouts.

The Calendar Component should wrap these libraries behind Helm’s own stable interface. If the underlying library changes later, the SDUI schema should not need to change.

**Editor inspector fields**

The Calendar inspector should include:

- `variant`: Month / Week / Day / Event List / Compact.
- `title` or display name if needed.
- selected sources/calendars.
- filters/categories.
- default visible date behavior: today/current range by default.
- max events for Compact/Event List.
- show/hide event metadata options if needed.

Do not expose low-value styling controls before the functional behavior works. Prioritize working data, fitting in the cell, correct navigation, and event details.

**Template usage**

- Personal Dashboard: Weather + Compact Calendar in a 50/50 row.
- Daily Planner: Calendar in Week variant inside the vertical Empty Container layout.
- Full Calendar module: Month or Week variant depending on template.

**Acceptance criteria**

- Calendar is a first-class real component in the registry.
- Variants render real layouts, not fake placeholders.
- Compact works inside small cells.
- Month/Week/Day/Event List do not overflow their cells.
- User can navigate dates but cannot switch variants on mobile.
- Admin can select variant and filters.
- Event details open correctly.
- Local event data renders end-to-end.
- Future CalDAV/Notion sources can map into the same unified event model.

### Chat

Continue deferring.

### Notes

The Notes Component should stay as a real first-class local-first document/feed component, not fake static template content.

**Current direction**

- Keep Notes as a real component/module in the same tier as Calendar, Chat, InputBar, Todo, etc.
- Do not deeply redesign Notes in this round. Prioritize fixing App Editor, Module Editor, rows/cells, Calendar, templates, versioning, preview, publish, and sync first.
- Notes should still be correctly wired wherever templates use it.

**Core behavior**

- Notes is a document/feed-style area.
- It shows a list/feed of notes with title, preview text, author icon, and timestamp.
- Tapping a note opens a full-page reading view.
- Notes support rich formatting through Markdown rendering.
- User-created notes can be editable through the dual view/edit Markdown source model.
- AI-created notes are read-only by default and visually distinguished with author icons.

**Data model**

- Use a local-first SQLite `notes` table as the primary source of truth.
- Notes must work locally before any remote sync exists.
- Remote connectors can be added later for Notion pages, Apple Notes, or other note services.
- The component should read/write through the backend/local notes API instead of relying on fake template data.

**Template usage**

- Home / Personal Dashboard: Notes Component shows the most recent note or quick note.
- Daily Planner: Notes Component shows today’s notes inside the vertical Empty Container layout, alongside Calendar and Todo.
- Template buttons such as `+ New Note` should eventually call the real `notes.create` server action with automatic loading behavior.

**Implementation priority**

- V1 priority is correct backend binding, real data rendering, and template integration.
- Do not spend V1 effort on advanced Notes features like Notion sync, Apple Notes sync, image upload, collaboration, folders, tags, or SDUI-rendered interactive notes.

### Input bar

This thing needs to get working. i think this requires the server backend mechanisms to be working. For example, things like workflows and variables need to be properly binded to this. At the moment right now, it’s functionality should have basically sending an action to the backend server including what’s inside the input bar when clicking send. 

### Todo, Article Card, Rich Text Renderer, Rich Text

i want you to make this functional with what is in the templates. Make sure they are fully functional. Don’t make custom components. You should basically build the templates from scratch. i want the todo list article cards to actually work, not just look good when I open the mobile app if you get what I mean.

### Templates

most of the templates are not functional. Brainstorm and plan out what might be a functional template and then actually go make it. Right now all of them are dog shit. 

## Templates

Like mentioned before, this needs huge rework and rebrainstorming and reassessment of what we need. When coding these you should only be sending the json. So it’s sort of a 2 step process. You make the backend fully complete, and when you need to code this entire thing just have a json ready to send for this and they should have all the functional feature. if you can’t just send a json directly then you are doing something wrong. 

Again preview needs to be really reworked. 

## Workflows

this parts look like it’s starting to be complete. But I need some test workflows I can see myself other wise it’s kind of useless and i can’t really test it out.

## Variables

Same as workflows. It needs to be have some samples that I can just test it out to make sure it works other wise it is kind of useless.

## Connections

Looks good but I don’t know how this is used directly in the program and I don’t know how everything is done.

## Logs

Looks like it has no issues, you can use this more i guess.

## Settings

I don’t know what im looking at but I have a high confidence that this is not intentional. Admin panels are not registered devices. The only registered devices are the frontend ones. None of these count. 

## Delivery / Versioning Model — Full Implementation Spec

This section is the complete delivery/versioning model for the vibe-code agent. Do not treat this as a loose brainstorm. This is the intended product behavior for how edits move from Helm Admin → preview → finalized mobile screen. The current `draft v1 / approve / reject` model is not the right UX for Helm because Helm is single-user/self-hosted and the admin is the end user. The underlying need is still real, but the model should be renamed and rebuilt around **document-like editing, timestamped versions, preview sessions, and app-level publish**.

### Core principle

The mobile app should not receive random live mutations from every editor action. The mobile app renders a selected **App Version** that is produced by the App Editor. The Module Editor edits modules like a document and can preview modules inside the web admin, but it never pushes directly to mobile.

Canonical flow:

```
Module Editor edits module content
	↓
Autosaved module working draft / checkpoints
	↓
Web Admin module preview only
	↓
Module version becomes available to App Editor

App Editor chooses module versions and app-level settings
	↓
Full app preview in Web Admin OR temporary preview on selected mobile device
	↓
Publish from App Editor
	↓
Mobile device renders the published App Version
```

Important: **Mobile preview and mobile publish always originate from the App Editor, never from the Module Editor.** The reason is that the phone renders a full app context: bottom bar, Launchpad, module references, theme, dark mode, default launch module, device assignment, and selected module versions. An isolated module by itself is not the final mobile app.

### Required terminology

Use these terms in the UI and code comments. Do not use `draft v1`, `approve`, or `reject` for this flow.

- **Working Draft** — the mutable autosaved state currently being edited.
- **Checkpoint** — an immutable saved snapshot created from a working draft.
- **Version** — an immutable named/timestamped snapshot that can be referenced, restored, previewed, or published.
- **Live Version** — the currently published app version assigned to a mobile device.
- **Preview Session** — a temporary render of a draft/version, either in web admin or on a selected mobile device.
- **Publish** — promote an App Editor draft/version into the live app version for assigned devices.
- **Restore** — copy a previous version/checkpoint into the current working draft. Restoring does not automatically publish.
- **Pin** — make an app reference one specific module version.
- **Use newest** — make the App Editor choose the newest available module version when resolving the app draft/preview/publish.

### Version naming rule

Do not use `v1`, `v2`, `v3`, etc. as the visible version names. These numbers are confusing and meaningless for Barry. Every app/module/template version or checkpoint should have a timestamp-based default name. The user can rename the version later.

Default version/checkpoint names:

```
2026-05-13 09:44
2026-05-13 09:44 — App Editor delivery model
2026-05-13 09:44 — Home module layout checkpoint
2026-05-13 09:44 — Daily Planner template update
```

Required fields for every visible version/checkpoint:

- **Default timestamp name** — generated automatically from local timezone, Asia/Shanghai unless user changes timezone.
- **Custom display name** — optional user-renamable label.
- **Created time** — exact timestamp.
- **Source** — App Editor, Module Editor, Template Editor, AI agent, manual restore, template apply, import.
- **Status** — working draft, checkpoint, published/live, archived, restored source, previewed, failed validation.
- **Parent version/checkpoint** — for the version tree.
- **Used by** — apps/devices/templates/modules that reference it.
- **Validation status** — valid, warning, invalid, not checked.
- **Change summary** — short optional text. Auto-generated if possible, user-editable.

### Version tree, not meaningless version numbers

The UI should show version history as a timestamped tree, not a flat `v1/v2/v3` list.

Example Module version tree:

```
Home Module
├── 2026-05-13 09:44 — Current working draft
│   ├── 2026-05-13 09:35 — Added compact calendar
│   └── 2026-05-13 09:21 — Fixed weather row
├── 2026-05-12 22:10 — Live in Main Sample App
└── 2026-05-11 18:02 — Before todo component rewrite
```

Example App version tree:

```
Main Sample App
├── 2026-05-13 09:44 — Current working draft
│   ├── references Home Module: Use newest
│   ├── references Chat Module: 2026-05-12 20:14 — Stable chat
│   └── references Daily Planner: Use newest
├── 2026-05-12 23:30 — Live on Barry's iPhone
└── 2026-05-11 19:20 — Before App Editor redesign
```

Example Template version tree:

```
Daily Planner Template
├── 2026-05-13 09:44 — Uses real Todo component
├── 2026-05-12 21:00 — Week calendar + notes
└── 2026-05-10 17:30 — Old fake checkbox version
```

The tree does not need full Git branching in v1. The important requirements are: immutable snapshots, parent-child relationship, restore, compare, rename, and clear display of what is live/used.

---

### Entity model

The vibe-code agent should implement or refactor toward these conceptual entities. Exact table names can follow existing project conventions, but the concepts must exist.

#### App

An App is the full mobile experience assigned to a device. It owns app-level metadata and references modules.

App fields:

- `id`
- `name`
- `icon`
- `description`
- `current_working_draft_id`
- `current_published_version_id`
- `created_at`
- `updated_at`
- `deleted_at` or archived flag

App-level config includes:

- app name
- app icon
- splash screen
- global theme
- design tokens
- dark mode setting
- default launch module
- bottom bar configuration
- Launchpad configuration
- enabled/disabled module membership
- device assignments
- module references and version selection policy

#### App Working Draft

The mutable app draft currently being edited in App Editor.

Fields:

- `id`
- `app_id`
- `config_json`
- `module_references`
- `last_autosaved_at`
- `validation_status`
- `validation_errors`
- `base_version_id` — the version/checkpoint this draft came from
- `dirty` flag

#### App Version

Immutable published/checkpoint snapshot of an app.

Fields:

- `id`
- `app_id`
- `display_name`
- `default_timestamp_name`
- `custom_name`
- `config_json`
- `resolved_module_versions`
- `module_reference_policies`
- `schema_version`
- `min_mobile_runtime_version`
- `created_at`
- `created_by`
- `source`
- `parent_version_id`
- `status`
- `validation_result`
- `change_summary`

Important: When an App Version is published, it should store a reproducible snapshot of what module versions were used at publish time. Even if an App Editor reference says "Use newest", the published App Version should record which concrete module version was resolved. This prevents old published app versions from changing unexpectedly later.

#### Module

A Module is one page/screen in the mobile app. It is shared/function-like across apps.

Fields:

- `id`
- `name`
- `icon`
- `description`
- `enabled_default`
- `current_working_draft_id`
- `current_version_id`
- `created_at`
- `updated_at`

#### Module Working Draft

The mutable document-like state edited in Module Editor.

Fields:

- `id`
- `module_id`
- `sdui_json`
- `last_autosaved_at`
- `base_version_id`
- `validation_status`
- `validation_errors`
- `dirty`

#### Module Version

Immutable module checkpoint/version.

Fields:

- `id`
- `module_id`
- `display_name`
- `default_timestamp_name`
- `custom_name`
- `sdui_json`
- `schema_version`
- `required_component_types`
- `required_action_types`
- `required_data_bindings`
- `created_at`
- `source`
- `parent_version_id`
- `validation_result`
- `change_summary`

#### Template

A Template is a reusable source for creating/updating modules. Templates are not live mobile screens.

Fields:

- `id`
- `name`
- `description`
- `category`
- `current_version_id`
- `created_at`
- `updated_at`

#### Template Version

Immutable template version.

Fields:

- `id`
- `template_id`
- `display_name`
- `default_timestamp_name`
- `custom_name`
- `template_json`
- `created_at`
- `source`
- `parent_version_id`
- `validation_result`
- `change_summary`

#### Device

A registered mobile frontend.

Fields:

- `id`
- `device_name`
- `device_type`
- `platform`
- `installed_runtime_version`
- `supported_schema_versions`
- `assigned_app_id`
- `active_app_version_id`
- `last_seen_at`
- `connection_status`
- `update_status`
- `preview_session_id`

#### Preview Session

Temporary preview state. Preview sessions must not overwrite live versions.

Fields:

- `id`
- `target_type` — web_admin or mobile_device
- `device_id` — nullable for web preview
- `app_id`
- `app_draft_id` or `app_version_id`
- `resolved_config_json`
- `resolved_module_versions`
- `created_at`
- `expires_at`
- `status` — active, expired, exited, failed
- `validation_result`

---

### Module Editor behavior — Word document model

The Module Editor should feel like a Word document / Notion page editor. You are editing the module itself, continuously. There is no `approve/reject` mental model here.

#### Module Editor responsibilities

The Module Editor owns:

- row/cell/component canvas editing
- component props
- bindings
- actions/rules
- module-level name and icon
- module working draft
- module checkpoints/version history
- web-admin module preview

The Module Editor does **not** own:

- bottom bar position
- Launchpad membership
- device assignment
- full-app preview
- mobile-device preview
- publishing to mobile

#### Module Editor top bar

Recommended top bar:

```
[Module: Home ▼]  Saved 10:02  [Create Checkpoint] [Preview in Web Admin] [Version History]
```

Do not show:

```
Draft v1 | Approve | Reject | Push to Mobile
```

#### Autosave

Every edit in the Module Editor should autosave into the Module Working Draft. Autosave is not a published version and not a mobile update.

Autosave requirements:

- Debounced autosave after edits.
- Show save state: Saving..., Saved 10:02, Save failed.
- If save fails, keep local unsaved state and show retry.
- Do not create a new visible version for every keystroke/drag.
- Periodically create internal recovery snapshots if needed, but do not clutter the visible version tree.

#### Checkpoints

The user or system can create a visible checkpoint from the current working draft.

Checkpoint triggers:

- User clicks **Create Checkpoint**.
- Before applying a template over an existing module.
- Before restore.
- Before risky bulk operation.
- Optional automatic checkpoint after a major AI-generated change.

Checkpoint naming:

- Default timestamp name.
- Optional AI-generated suffix from change summary.
- User can rename.

#### Module web preview

The Module Editor preview is **only inside the web admin**.

Module web preview requirements:

- Render the current module working draft.
- Use the same SDUI renderer logic as close as possible to mobile.
- Show selected viewport/device size if available.
- Show validation warnings inline.
- Must not create a mobile preview session.
- Must not overwrite any app live version.

#### Module version creation

A Module Version is created when a working draft is checkpointed/finalized. This makes the module version available for App Editor references.

Important: Creating a Module Version does not update mobile by itself. Mobile only changes after App Editor preview/publish.

#### Module restore

Restoring a Module Version should copy that version's SDUI JSON into the Module Working Draft.

Restore behavior:

```
User selects old module version
	↓
Clicks Restore to Working Draft
	↓
Current working draft is replaced
	↓
Autosave
	↓
User can preview in web admin
	↓
User can create checkpoint/version
```

Restore does not publish to mobile.

---

### App Editor behavior — full-app composition and publish model

The App Editor is the only place where preview-to-mobile and final mobile publish happens.

#### App Editor responsibilities

The App Editor owns:

- app-level metadata
- app theme/design tokens
- dark mode
- app icon/name/splash
- default launch module
- bottom bar configuration
- Launchpad configuration
- module membership
- module enable/disable
- module version reference selection
- device assignment
- full-app web preview
- temporary mobile preview
- final publish to mobile

#### App Editor top bar

Recommended top bar:

```
[App: Main Sample ▼]  Saved 10:02  Live: 2026-05-12 23:30  [Preview ▼] [Publish to Mobile] [Version History]
```

Preview dropdown:

```
Preview in Web Admin
Preview on Device...
```

Publish button:

```
Publish to Mobile
```

#### App Editor module reference selector

Every module reference in the App Editor should explicitly select how it resolves versions.

For each module in the app:

```
Module: Home
Icon: 🏠
Enabled: true
Bottom bar: slot 1
Version source:
	( ) Use newest version
	( ) Use specific version: [2026-05-12 22:10 — Stable Home ▼]
```

#### Use newest version

Meaning:

- In the App Editor working draft, this module reference resolves to the newest valid Module Version.
- App Editor preview uses the newest valid Module Version at preview time.
- App Editor publish resolves the newest valid Module Version and stores that exact module version inside the published App Version snapshot.

Important: A live published app should not silently change on mobile just because a newer module version appears later. To update the live mobile app, the user must publish from the App Editor again. This keeps mobile changes controlled by App Editor.

#### Use specific version

Meaning:

- The app reference is pinned to one selected Module Version.
- Future module edits do not affect this app unless the user changes the selected version or switches to Use newest.
- This is for stability.

#### App version snapshot behavior

When publishing an App Version, store both:

- the user's module reference policy (`use_newest` or `specific_version`)
- the concrete resolved module version IDs used in this published snapshot

Example:

```json
{
  "moduleReferences": [
    {
      "moduleId": "home",
      "policy": "use_newest",
      "resolvedModuleVersionId": "home-2026-05-13-0944"
    },
    {
      "moduleId": "chat",
      "policy": "specific_version",
      "selectedModuleVersionId": "chat-2026-05-12-2014",
      "resolvedModuleVersionId": "chat-2026-05-12-2014"
    }
  ]
}
```

The published App Version must be reproducible later. If the user restores `2026-05-13 09:44 — Main Sample App`, it should render with the exact module versions used at that time, not whatever happens to be newest today.

---

### Preview model

There are three preview surfaces. They are not interchangeable.

#### 1. Module web preview

Where: Module Editor only.

Purpose:

- Preview a single module's working draft inside web admin.
- Check rows/cells/components/props/layout.
- No mobile preview.
- No app-level bottom bar/Launchpad context.

#### 2. Full app web preview

Where: App Editor.

Purpose:

- Preview the entire app inside web admin.
- Includes app-level shell: bottom bar, Launchpad, default launch module, theme, dark mode, selected module versions.
- Good for fast iteration.

Flow:

```
App Editor → Preview → Preview in Web Admin
	↓
Resolve app draft + selected module versions
	↓
Validate
	↓
Render full app in web admin popup/preview mode
```

#### 3. Temporary mobile preview

Where: App Editor only.

Purpose:

- Preview the whole app on real mobile hardware.
- Test actual mobile rendering, gestures, screen size, performance, native behavior.
- Does not replace live app.

Flow:

```
App Editor → Preview → Preview on Device
	↓
User selects device
	↓
Backend resolves app draft + module versions
	↓
Backend validates config against selected device runtime
	↓
Backend creates Preview Session
	↓
Device receives preview_session_started event
	↓
Device fetches preview config
	↓
Device enters Preview Mode
	↓
User exits Preview Mode
	↓
Device returns to current Live Version
```

Mobile Preview Mode UI:

```
Preview Mode
Main Sample App — 2026-05-13 09:44
[Exit Preview]
```

The mobile device must clearly indicate it is in Preview Mode so the user does not confuse temporary preview with the live app.

Preview session rules:

- Preview expires automatically after a configured timeout.
- If device disconnects, preview session can be resumed only if still valid.
- Exiting preview returns to the previous live app version.
- Preview must not change `active_app_version_id`.
- Preview must not mark app as published.
- Preview errors are logged in admin.

---

### Publish model

Publishing is the only way to finalize what the mobile device renders live.

Publish flow:

```
User edits App Editor working draft
	↓
User previews in web admin or device if desired
	↓
User clicks Publish to Mobile
	↓
Backend runs publish validation
	↓
Backend creates immutable App Version
	↓
Backend marks it as current_published_version_id for the App
	↓
Backend notifies assigned devices
	↓
Devices fetch new App Version
	↓
Devices validate locally
	↓
Devices cache new version
	↓
Devices atomically switch live render to new version
```

Publish modal should show:

```
Publish to Mobile?

App: Main Sample
New version name: 2026-05-13 10:02 — App delivery model
Assigned devices:
- Barry's iPhone
- Test Android

Module versions included:
- Home — 2026-05-13 09:44 — Home module layout checkpoint
- Chat — 2026-05-12 20:14 — Stable chat
- Daily Planner — 2026-05-13 09:50 — Real Todo component

Validation:
✅ App schema valid
✅ Bottom bar has 5 or fewer slots
✅ Launchpad references valid modules
✅ All module versions exist
✅ All components supported by selected devices
⚠️ Feed module has optional missing data binding fallback

[Cancel] [Publish]
```

After publish:

```
Published 2026-05-13 10:02 — App delivery model

Device status:
- Barry's iPhone: updated
- Test Android: pending, last seen 2h ago
```

Publish should never be a blind overwrite. It should always create an immutable timestamped App Version before devices update.

---

### Mobile live behavior

The mobile app has two rendering modes.

#### Live Mode

Normal mode. The device renders:

```
assigned_app.current_published_version
```

Live Mode requirements:

- On app launch, fetch assigned app and current published version.
- Cache last known good App Version locally.
- If offline, render last known good version.
- If fetch fails, keep last known good version.
- If the server publishes a new app version while connected, receive update notification and fetch.
- Apply updates atomically. Never leave the app half-updated.

#### Preview Mode

Temporary mode. The device renders a Preview Session created by App Editor.

Preview Mode requirements:

- Does not change active live version.
- Has visible Preview Mode indicator.
- Has Exit Preview action.
- Expires automatically.
- If preview config invalid, show error and return to live.
- If backend disconnects, keep preview only until expiry or exit.

#### Device update protocol

Recommended:

```
Backend sends WebSocket event:
{
  "type": "app_version_published",
  "appId": "...",
  "appVersionId": "...",
  "publishedAt": "2026-05-13T10:02:00+08:00"
}

Device responds by fetching:
GET /devices/:deviceId/assigned-app
GET /apps/:appId/versions/:versionId
```

Do not send the entire app JSON only through the WebSocket event. Use WebSocket as notification; REST fetch remains source of truth.

---

### Template model

Templates are versioned sources. Templates do not publish to mobile and do not preview on mobile directly.

Template flow:

```
Template Version
	↓ Apply to module
Module Working Draft
	↓ Web-admin module preview
Module Checkpoint / Module Version
	↓ Referenced by App Editor
App Preview / Publish
	↓ Mobile
```

Template requirements:

- Template versions have timestamped names and can be renamed.
- Applying a template to an existing module creates a checkpoint first.
- Applying a template should write to the Module Working Draft, not directly to live mobile.
- Template version history should show where it was applied.
- Existing modules created from old template versions should not update automatically when the template changes.

Template apply modal:

```
Apply Daily Planner Template

Template version:
[2026-05-13 09:44 — Uses real Todo component ▼]

Target:
[Create new module] or [Apply to existing module: Daily Planner ▼]

Before applying:
✅ Create checkpoint of current module

[Cancel] [Apply]
```

---

### Validation requirements

Validation must happen at multiple stages. This is mandatory because broken templates/components currently create invalid or junk states.

#### Autosave validation

Lightweight validation while editing:

- JSON parseable.
- Required high-level fields exist.
- No catastrophic invalid shape.
- Editor should still allow incomplete drafts but mark warnings.

#### Checkpoint/version validation

Before creating a visible checkpoint/version:

- SDUI schema valid.
- Rows/cells/components valid.
- Component type exists in registry.
- Component props match schema.
- Required bindings present or have fallbacks.
- Actions reference valid action types.
- Server actions exist in action registry if used.
- Variables are valid or show warnings.

#### App preview validation

Before full-app web/mobile preview:

- App config valid.
- Bottom bar <= 5 slots.
- Launchpad references enabled modules only.
- Default launch module exists and enabled.
- All module references resolve to valid module versions.
- If `Use newest`, newest valid module version exists.
- If `Use specific version`, selected version exists.
- Theme/dark mode tokens valid.
- Device runtime compatibility if previewing on mobile.

#### Publish validation

Before Publish to Mobile:

- All App preview validation checks.
- All selected devices can render required schema/component versions.
- No unknown component types.
- No fake template-only component types.
- No deleted modules referenced.
- No disabled module in bottom bar.
- Required app metadata present.
- Mobile runtime compatibility passes.
- Publish snapshot can be reproduced.

If publish validation fails, do not publish. Show exact errors and where to fix them.

Example publish error:

```
Cannot publish.

Home Module → Row 3 → Cell 1:
Unknown component type `todo`.
This component is used by Home Module version `2026-05-13 09:44`.
Fix: register Todo as a real component, or replace it with a supported component.
```

---

### Required API surface

Exact names can change to match the codebase, but these capabilities must exist.

#### Apps

```
GET /apps
POST /apps
GET /apps/:appId
PATCH /apps/:appId/draft
GET /apps/:appId/draft
POST /apps/:appId/checkpoints
GET /apps/:appId/versions
GET /apps/:appId/versions/:versionId
PATCH /apps/:appId/versions/:versionId/rename
POST /apps/:appId/versions/:versionId/restore-to-draft
POST /apps/:appId/preview/web
POST /apps/:appId/preview/device
POST /apps/:appId/publish
```

#### Modules

```
GET /modules
POST /modules
GET /modules/:moduleId
PATCH /modules/:moduleId/draft
GET /modules/:moduleId/draft
POST /modules/:moduleId/checkpoints
GET /modules/:moduleId/versions
GET /modules/:moduleId/versions/:versionId
PATCH /modules/:moduleId/versions/:versionId/rename
POST /modules/:moduleId/versions/:versionId/restore-to-draft
POST /modules/:moduleId/preview/web
GET /modules/:moduleId/usage
```

There should be no `POST /modules/:moduleId/preview/device`. Device preview belongs to App Editor only.

#### Templates

```
GET /templates
POST /templates
GET /templates/:templateId
GET /templates/:templateId/versions
POST /templates/:templateId/versions
PATCH /templates/:templateId/versions/:versionId/rename
POST /templates/:templateId/versions/:versionId/apply
```

#### Devices

```
GET /devices
POST /devices/register
GET /devices/:deviceId
PUT /devices/:deviceId/app
GET /devices/:deviceId/status
POST /devices/:deviceId/exit-preview
```

#### Preview sessions

```
GET /preview-sessions/:sessionId
POST /preview-sessions/:sessionId/exit
POST /preview-sessions/:sessionId/extend
```

---

### UI requirements

#### Module Editor UI

Must include:

- Collapsible module tree in sidebar.
- Current module name/icon.
- Autosave status.
- Create Checkpoint button.
- Preview in Web Admin button.
- Version History button.
- No mobile preview button.
- No Publish to Mobile button.
- No Approve/Reject terminology.

#### App Editor UI

Must include:

- App selector at top-left.
- Main iPhone-style app preview area.
- Bottom bar editor.
- Launchpad editor.
- Right inspector for app settings/module settings.
- Module version selector per module: Use newest / Use specific version.
- Preview dropdown: Web Admin / Device.
- Publish to Mobile button.
- Version History button.
- Device assignment UI.
- Device update status after publish.

#### Version History UI

Must include:

- Tree view.
- Timestamp default name.
- Custom user-renamable name.
- Status badges: Working Draft, Checkpoint, Live, Used by App, Used by Device, Archived.
- Source badges: App Editor, Module Editor, Template, AI, Restore, Import.
- Actions: Rename, Restore to Draft, Compare, Archive, View JSON.
- Used-by panel.

#### Template UI

Must include:

- Template version selector.
- Apply to new module / existing module.
- Auto-checkpoint before applying to existing module.
- No mobile publish controls.

---

### Edge cases

#### If user edits a module used by live app

Editing the module changes only the module working draft. It does not change the live app until App Editor publishes an app version that resolves to that module version.

#### If app uses newest module version

In App Editor draft/preview/publish, newest valid module version is selected. Published App Version stores the resolved concrete module version. Mobile live app does not change again until the App Editor publishes again.

#### If user pins a module version

The app stays on that module version until user changes it.

#### If a selected module version is deleted/archived

Do not break the app silently. Show warning in App Editor:

```
This app references an archived module version.
Choose a different version or restore the archived version.
```

#### If device is offline during publish

Publish still succeeds on backend. Device status becomes pending. When the device reconnects, it fetches and applies the latest published App Version.

#### If device cannot render published version

Device keeps last known good version and reports error to backend. Admin shows:

```
Barry's iPhone failed to update:
Unsupported component type `ArticleCard`.
Installed runtime: 2026-05-01
Required runtime: 2026-05-13
```

#### If mobile preview fails

Device exits preview and returns to live version. Backend logs preview failure.

#### If user restores old version

Restore copies old version into working draft. It does not publish automatically. User must preview/publish again from App Editor.

#### If test apps/templates are created during testing

Testing must clean up after itself. Do not leave random `Test App`, `New App`, `Test Module`, or junk templates in the editor. Tests should either use the main sample/template or create temporary entities with clear names and delete them after test completion.

---

### Acceptance criteria for vibe-code agent

The implementation is correct only if all of these are true:

- Module Editor feels like document editing with autosave/checkpoints.
- Module Editor has web-admin module preview only.
- Module Editor cannot preview on mobile.
- App Editor can preview full app in web admin.
- App Editor can create temporary mobile preview sessions.
- Temporary mobile preview does not overwrite live app.
- App Editor can publish to mobile.
- Publishing creates immutable timestamped App Version.
- Mobile renders published App Version.
- Mobile can return from preview to live version.
- App Editor module references support **Use newest version** and **Use specific version**.
- Published App Versions store resolved concrete module version IDs.
- Version names default to timestamps and can be renamed.
- Apps, modules, and templates all have version/checkpoint history.
- Templates never push directly to mobile.
- Applying template writes to module draft/checkpoint first.
- Restore never auto-publishes.
- Validation prevents invalid components/templates from being published.
- Unsupported mobile runtime keeps last known good version instead of crashing.
- Version History UI clearly shows live/used/previewed/restored/checkpoint states.
- No `draft v1 / approve / reject` terminology remains in this editor delivery flow.

### Final model summary

- **Module Editor:** Word-document-like editing. Continuous autosave. Timestamped checkpoints/versions. Web-admin module preview only. No mobile preview. No mobile publish.
- **App Editor:** Full app composition. Chooses newest or pinned module versions. Full app web preview. Temporary mobile preview. Final Publish to Mobile.
- **Templates:** Versioned sources. Applying a template updates a module draft/checkpoint. Templates do not preview/publish to mobile.
- **Mobile:** Has Live Mode and Preview Mode. Live Mode renders published App Version. Preview Mode renders temporary App Editor preview session. Mobile never renders an isolated Module Editor preview.

# Backend

## Deployment Plan — Backend + Helm Admin Bundled

The long-term deployment direction should be: **one Helm server process, one exposed port, one Docker deployment**.

### Core deployment goal

- Bundle the backend and Helm Admin together for production.
- Normal API/mobile/app traffic should continue going to the backend.
- Browser access to the server root should open Helm Admin.
- Production deployment should ideally expose only one port, with the backend serving both the API and the admin interface.

Example target behavior:

```
server:8000/        → Helm Admin
server:8000/admin   → Helm Admin
server:8000/api/... → Backend API
server:8000/ws/...  → Realtime/mobile updates
server:8000/mcp/... → MCP / agent-facing endpoints if applicable
```

### Important planning note for vibe-code agent

Do **not** blindly implement this as a quick routing hack. First inspect the actual current codebase structure, route layout, frontend build system, backend app entrypoint, Docker setup, and development workflow. Then produce an implementation plan that fits the existing architecture.

The exact route names, folder names, Dockerfile layout, and build steps can follow the current codebase. The product requirement is the deployment behavior, not a forced specific implementation.

### Expected production model

- Helm Admin can remain a normal web frontend during development.
- For production, Helm Admin should be built into static assets and served by the backend.
- The backend should own the public production port.
- API routes should be clearly namespaced so they do not collide with admin UI routes.
- Opening the base server URL in a browser should lead to Helm Admin, because Helm is self-hosted and the admin panel is the control surface.
- Mobile/frontend clients should still use explicit API/realtime endpoints, not depend on browser UI routes.

### Development vs production

- Development can keep separate dev servers if that is easier for hot reload and debugging.
- Production should prefer the bundled model for simple self-hosting.
- Do not make local development worse just to force the production model.

### Docker direction

- The production Docker setup should aim for a single Helm service.
- The container should expose one main port for the backend/admin bundle.
- Persistent data, database files, logs, and configuration should be handled cleanly through volumes/env files according to the existing backend conventions.
- If separate services are still needed internally later, hide that complexity behind Docker Compose instead of requiring the user to manually manage multiple exposed frontend/backend ports.

### Vibe-code agent planning requirements

Before implementing, the vibe-code agent should answer:

- What routes currently exist on the backend?
- Does the backend already namespace API routes cleanly?
- Where is Helm Admin built from, and what production build output does it create?
- Can the backend safely serve that build output without breaking existing API/WebSocket/MCP routes?
- What should happen at `/`, `/admin`, and unknown admin sub-routes?
- How should this work differently in dev vs production?
- What Dockerfile / Compose changes are needed?
- What tests confirm that API traffic, browser admin access, WebSocket updates, and mobile app sync all still work?

### Acceptance criteria

- One production deployment can run Helm backend + Helm Admin together.
- Only one main port needs to be exposed for normal self-hosted usage.
- Visiting the server root in a browser opens Helm Admin.
- API, WebSocket, MCP, mobile sync, and publish/preview behavior still work.
- Admin frontend routing works after browser refresh on nested admin pages.
- Development hot reload remains possible.
- Docker deployment is simple enough for a self-hosted user.
- The implementation does not hardcode assumptions that conflict with the existing codebase.

### Revert / fallback plan

If the bundled model causes problems, keep a clean fallback path:

- Run Helm Admin as a separate frontend service again.
- Keep the backend API service separate.
- Optionally place a reverse proxy in front later.
- Do not design the bundled deployment in a way that makes separating admin/backend impossible.

# MCP/agents

We are at the stage where everything is almost setup. I want you to start working on the MCP and make it complete. The next stage i will directly connect you to the MCP so you can try to work like this and see the flaws. In addition, you will be given tasks by summon sub agents to let them try to complete the MCP and create frontend apps by directly letting them do it instead of you doing it yourself when knowing everything. Understand? Start working on it and integrating it into the QA system and just making sure everything is AI ready. 

# Others

One last thing is useful resources. One thing I found really good is this [https://github.com/millionco/react-doctor](https://github.com/millionco/react-doctor). I have added this to be part of the Reviewer agent. 

## Research findings — reusable resources

- [https://github.com/divkit/divkit](https://github.com/divkit/divkit): Open-source server-driven UI framework. Useful for Helm’s SDUI renderer, schema design, variables, triggers, patches, cross-platform rendering model, and “server JSON drives app UI” architecture. Do not copy the whole framework blindly because Helm is React Native/Expo + custom editor, but use DivKit as the closest reference for JSON layout structure, variables, actions, validation, and renderer boundaries. Installation/reference: clone/read repo and docs; DivKit has client SDKs and a TypeScript/Python/Kotlin DSL, but for Helm it is probably better to study the JSON schema and renderer architecture instead of importing it wholesale.
- [https://divkit.tech/en/](https://divkit.tech/en/): Official DivKit documentation/playground. Useful for quickly testing SDUI ideas, especially variables, triggers, element patches, state changes, animations, and server-sourced UI updates. How to use: open playground/docs, compare DivKit JSON examples against Helm’s SDUI JSON, and borrow patterns for validation and patch/update semantics.
- [https://github.com/vercel-labs/json-render](https://github.com/vercel-labs/json-render): Generative UI framework where AI outputs constrained JSON that renders using a component catalog. Very relevant to Helm’s AI-ready MCP/editor direction because it solves the “AI can only use known components and schemas” problem. Useful for SDUI schema, component catalog, AI guardrails, and export-to-code ideas. Installation: `npm install @json-render/core @json-render/react`; for React Native, evaluate the React Native catalog path and adapt the schema approach rather than importing directly if incompatible.
- [https://json-render.dev/](https://json-render.dev/): Official json-render docs. Useful for designing AI → JSON → UI workflow, especially constrained component catalogs, predictable schema output, progressive rendering, and standalone code export. How to use: study the examples and map Helm component registry to a similar catalog contract.
- [https://github.com/clauderic/dnd-kit](https://github.com/clauderic/dnd-kit): Modern drag-and-drop toolkit for React. Useful for Helm Admin / Module Editor web canvas: row reorder, cell drag handles, sidebar-to-canvas component drops, sortable module trees, and app editor launchpad/bottom-bar drag behavior. Installation: newer docs use `npm install @dnd-kit/react`; older ecosystem also has `@dnd-kit/core` and `@dnd-kit/sortable`. Use for web admin only, not mobile runtime.
- [https://dndkit.com/](https://dndkit.com/): Official dnd kit docs. Useful for implementing smooth accessible drag/drop with sensors, collision detection, sortable lists, keyboard support, modifiers, and constraints. How to use: follow React quickstart, then implement custom collision/validation so invalid row/cell moves are blocked before commit.
- [https://github.com/xyflow/xyflow](https://github.com/xyflow/xyflow): React Flow / xyflow, open-source node-based editor library. Useful for Helm Workflows UI, visual MCP/agent workflows, variable/action graphs, and maybe version/dependency diagrams. It provides nodes, edges, zoom/pan canvas, minimap, custom node rendering, and connection validation. Installation: use the React Flow package from xyflow docs, usually `npm install @xyflow/react`. Use for admin workflow editor, not mobile runtime.
- [https://reactflow.dev/](https://reactflow.dev/): Official React Flow docs. Useful for building workflow graphs quickly instead of creating a node editor from scratch. How to use: start from examples for custom nodes/edges, save nodes+edges JSON to backend, and keep actual workflow execution in Helm backend rather than relying on React Flow frontend state.
- [https://github.com/retejs/rete](https://github.com/retejs/rete): TypeScript-first visual programming framework with both editor UI and graph processing concepts. Useful if Helm Workflows need more than a diagram and require actual dataflow/control-flow execution. Installation/reference: use Rete docs and `npx rete-kit app` for a starter. Compare against React Flow: React Flow is simpler for UI; Rete is stronger if workflow execution semantics are central.
- [https://retejs.org/](https://retejs.org/): Official Rete.js docs/examples. Useful for studying visual workflow engines, insert-node behavior, plugin architecture, dataflow/control-flow graph processing, and node editor customization. How to use: review examples first; only import if Helm workflows need executable visual programming, otherwise React Flow may be lighter.
- [https://github.com/wix/react-native-calendars](https://github.com/wix/react-native-calendars): Mature React Native calendar component for iOS/Android. Useful for Helm Calendar Month variant, date marking, day press behavior, agenda list, multi-dot source colors, and swipeable calendar. Installation: `npm install react-native-calendars` or `yarn add react-native-calendars`. Use for Month/Agenda; do not force it to handle time-block Week/Day if another library does that better.
- [https://wix.github.io/react-native-calendars/docs/Intro](https://wix.github.io/react-native-calendars/docs/Intro): Official react-native-calendars docs. Useful for implementing Month view with marked dates, custom day rendering, locale formatting, disabled dates, agenda integration, and accessibility. How to use: wrap it behind Helm’s own Calendar component interface so Helm SDUI schema is stable if the library changes later.
- [https://github.com/acro5piano/react-native-big-calendar](https://github.com/acro5piano/react-native-big-calendar): Google Calendar / Outlook-like React Native calendar. Useful for Calendar Week, Day, and maybe 3-day time-block variants. Installation: `npm install react-native-big-calendar` or `yarn add react-native-big-calendar`. Use together with `react-native-calendars`: Month from Wix, time-block views from Big Calendar.
- [https://github.com/natelindev/tsdav](https://github.com/natelindev/tsdav): TypeScript WebDAV/CalDAV/CardDAV client. Useful for future Calendar source syncing: Google/iCloud/Fastmail/Nextcloud CalDAV connectors into Helm’s unified local event model. Installation: `npm install tsdav` or `yarn add tsdav`. Use in backend or sync layer, not directly inside Calendar UI.
- [https://github.com/KlautNet/ts-caldav](https://github.com/KlautNet/ts-caldav): Lightweight TypeScript CalDAV client that claims browser, Node.js, and React Native support. Useful for calendar sync experiments and local-first calendar ingestion. Installation: npm package from repo docs. Use for fetching calendars/events, recurrence/timezone handling, and sync tokens if it fits Helm’s backend/mobile architecture.
- [https://docs.expo.dev/versions/latest/sdk/sqlite/](https://docs.expo.dev/versions/latest/sdk/sqlite/): Expo SQLite official docs. Useful for Helm local-first mobile storage: events, notes, todos, app versions, cached published app config, preview sessions, and offline mode. Installation: `npx expo install expo-sqlite`. Use as the default local database layer unless Helm needs WatermelonDB’s heavier sync abstraction.
- [https://docs.expo.dev/guides/local-first/](https://docs.expo.dev/guides/local-first/): Expo local-first architecture guide. Useful for confirming the local-first direction and selecting SQLite/TinyBase/Yjs-style persistence layers. How to use: treat as architecture reference for offline-first mobile app state; Calendar/Notes/Todo should read local SQLite first, then sync remote sources into local tables.
- [https://github.com/Nozbe/WatermelonDB](https://github.com/Nozbe/WatermelonDB): Reactive SQLite-backed database for complex React Native apps. Useful if Helm’s local-first data becomes large and needs reactive queries + sync protocol. Installation: follow WatermelonDB docs; setup is heavier than Expo SQLite. Use only if plain Expo SQLite + Drizzle/live queries becomes too manual.
- [https://github.com/mrousavy/react-native-mmkv](https://github.com/mrousavy/react-native-mmkv): Very fast React Native key-value storage. Useful for tiny hot-path settings: active app version ID, last known good version pointer, auth/session tokens if appropriate, feature flags, onboarding state, and cached UI preferences. Installation: `npm install react-native-mmkv`. Do not use as main structured event/notes database; use SQLite for relational data.
- [https://github.com/software-mansion-labs/react-native-enriched-markdown](https://github.com/software-mansion-labs/react-native-enriched-markdown): React Native Markdown rendering + rich text input with Markdown output. Useful for replacing the old Text component with Markdown/Text and supporting editable Markdown notes. Caveat: requires React Native New Architecture/Fabric on native platforms. Installation: follow repo package instructions; test compatibility with Expo/RN version before committing.
- [https://github.com/Expensify/react-native-live-markdown](https://github.com/Expensify/react-native-live-markdown): Drop-in React Native TextInput replacement with live Markdown formatting. Useful for Markdown editor/input areas and notes editing if we want Markdown syntax visible while formatted. Installation: follow repo docs; example imports `MarkdownTextInput` and parser. Need QA around Enter/newline behavior because current Helm bug is Markdown line breaks.
- [https://www.npmjs.com/package/react-native-markdown-display](https://www.npmjs.com/package/react-native-markdown-display): React Native Markdown renderer using markdown-it. Useful for read-only Markdown rendering in Text/Notes/Rich Text Renderer components. Installation: `npm install react-native-markdown-display`. Use for rendering; pair with a separate editor/input for editing.
- [https://github.com/rjsf-team/react-jsonschema-form](https://github.com/rjsf-team/react-jsonschema-form): React JSON Schema Form. Useful for Helm Admin inspector panels: generate component property forms from JSON Schema instead of hand-coding every settings panel. Installation: follow RJSF docs, generally `npm install @rjsf/core @rjsf/validator-ajv8`. Use with Helm component schemas so each component defines its inspector automatically.
- [https://rjsf-team.github.io/react-jsonschema-form/docs/](https://rjsf-team.github.io/react-jsonschema-form/docs/): Official RJSF docs. Useful for themes, uiSchema, custom widgets, validation, and form customization. How to use: define each Helm component’s props schema, generate inspector UI from it, and plug validation errors back into publish/checkpoint validation.
- [https://github.com/ajv-validator/ajv](https://github.com/ajv-validator/ajv): Fast JSON Schema validator. Useful for SDUI schema validation, component props validation, template import validation, app publish validation, and API request validation. Installation: `npm install ajv`. Use in backend and admin build/test scripts; pair with custom error messages so publish errors point to “Module → Row → Cell → Component”.
- [https://github.com/colinhacks/zod](https://github.com/colinhacks/zod): TypeScript-first schema validation. Useful for internal TypeScript data models, API contracts, MCP tool inputs, and converting schemas to JSON Schema if needed. Installation: `npm install zod`. Use for developer-friendly validation where TS inference matters; use AJV where strict JSON Schema validation and performance matter.
- [https://github.com/praneshr/react-diff-viewer](https://github.com/praneshr/react-diff-viewer): React text diff viewer. Useful for Version History compare UI: compare app/module/template JSON snapshots, generated summaries, or text content. Installation: `npm install react-diff-viewer`. Might be older; also check maintained forks before final import.
- [https://github.com/Aeolun/react-diff-viewer-continued](https://github.com/Aeolun/react-diff-viewer-continued): Maintained continuation of react-diff-viewer. Useful for modern React diff display in version history. Installation: `npm install react-diff-viewer-continued`. Prefer this over the original if dependency compatibility is better.
- [https://github.com/relex/json-diff-react](https://github.com/relex/json-diff-react): Structural JSON diff React component. Useful for comparing App Version / Module Version JSON as objects instead of raw text. Installation: follow repo/npm package docs. Use for “View JSON / Compare” in version history because Helm versions are JSON snapshots.
- [https://github.com/liveblocks/frimousse](https://github.com/liveblocks/frimousse): Lightweight composable React emoji picker. Useful for Helm Admin icon picker for app/module icons if using emoji icons. Installation: `npm install frimousse`. Use in admin web UI, not mobile runtime.
- [https://github.com/ealush/emoji-picker-react](https://github.com/ealush/emoji-picker-react): Popular customizable React emoji picker. Useful for module/app icon settings in Helm Admin. Installation: `npm install emoji-picker-react`. Probably easiest to drop in quickly; compare bundle size against Frimousse.
- [https://github.com/lucide-icons/lucide](https://github.com/lucide-icons/lucide): Large open-source icon set with React and React Native packages. Useful for app/module/component icons, admin UI icons, and default icon registry. Installation: web `npm install lucide-react`; React Native use `lucide-react-native` and `react-native-svg` per docs. Watch React/RN peer dependency compatibility before committing.
- [https://lucide.dev/guide/packages/lucide-react-native](https://lucide.dev/guide/packages/lucide-react-native): Official Lucide React Native package docs. Useful for mobile icon rendering with native SVGs. How to use: install `lucide-react-native` plus `react-native-svg`, then wrap icons behind Helm’s Icon component so the SDUI JSON stores stable icon names rather than direct library imports.
- [https://docs.expo.dev/guides/icons/](https://docs.expo.dev/guides/icons/): Expo Vector Icons docs. Useful as the safest Expo-compatible icon path for built-in icon fonts like Ionicons, FontAwesome, Feather, etc. Installation: Expo projects usually use `@expo/vector-icons`; follow Expo docs. Good fallback if Lucide RN compatibility is annoying.
- [https://github.com/mobile-dev-inc/Maestro](https://github.com/mobile-dev-inc/Maestro): Open-source mobile/web E2E testing framework using YAML flows. Useful for Helm QA system because Barry needs to test real mobile behavior, preview mode, publish flow, launchpad, calendar, todo, input bar, and template functionality. Installation: follow Maestro docs; tests are YAML and run against emulator/simulator/device. Big advantage: no app instrumentation and Expo compatibility.
- [https://docs.maestro.dev/get-started/supported-platform/react-native](https://docs.maestro.dev/get-started/supported-platform/react-native): Maestro React Native docs. Useful for writing QA flows for React Native/Expo. How to use: add stable accessibility labels/test IDs to Helm mobile components, then create Maestro flows for launchpad, app preview, publish, component interactions, and template smoke tests.
- [https://github.com/wix/Detox](https://github.com/wix/Detox): Gray-box E2E testing framework for React Native. Useful for deeper RN test automation if Helm needs more synchronization with app internals than Maestro gives. Installation: `npm install detox --save-dev` plus native setup from docs. More setup than Maestro, so use Maestro first unless Detox’s gray-box behavior is needed.
- [https://github.com/microsoft/playwright](https://github.com/microsoft/playwright): Browser E2E testing framework. Useful for Helm Admin QA: App Editor, Module Editor, drag/drop, version history, publish modal, logs, workflow editor, and backend-admin integration. Installation: `npm init playwright@latest` or `npm install -D @playwright/test`. Use with a seeded test database and cleanup after test completion.
- [https://fastapi.tiangolo.com/tutorial/static-files/](https://fastapi.tiangolo.com/tutorial/static-files/): Official FastAPI static files docs. Useful for the Backend + Helm Admin bundled deployment requirement. How to use: build Helm Admin to static assets, mount assets through `StaticFiles`, serve `index.html` for `/` and `/admin`, and keep API/WebSocket/MCP routes namespaced so admin routing does not collide.
- [https://github.com/fastapi/full-stack-fastapi-template](https://github.com/fastapi/full-stack-fastapi-template): Official-style full-stack FastAPI + React template with Docker, tests, CI, and production patterns. Useful as a reference for Helm’s backend/admin packaging, Docker Compose, API testing, and frontend/backend separation. Do not copy blindly; use as a reference for project structure, Docker, CI, and testing patterns.
- [https://github.com/Shopify/react-native-skia](https://github.com/Shopify/react-native-skia): High-performance React Native graphics library. Useful if Helm later needs custom high-performance rendering, charts, canvas-like previews, or advanced visual widgets. Installation in Expo: `npx expo install @shopify/react-native-skia`. Not needed for basic rows/cells; only use for graphics-heavy components.
- [https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/handling-gestures/](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/handling-gestures/): Reanimated + Gesture Handler docs. Useful for smooth mobile drag/resize/reorder interactions if the mobile runtime/editor ever needs native gestures. Installation: follow Expo/RN Reanimated and Gesture Handler setup. For Helm Admin web drag/drop use dnd-kit; for mobile gestures use Reanimated/RNGH.
- [https://github.com/computerjazz/react-native-draggable-flatlist](https://github.com/computerjazz/react-native-draggable-flatlist): Drag-and-drop FlatList for React Native. Useful for mobile-side reorderable lists such as Todo, Notes ordering, or if mobile ever allows editing bottom bar/launchpad order directly. Installation: `npm install react-native-draggable-flatlist`; requires Reanimated and Gesture Handler. Use only where FlatList-style reordering is needed.
- [https://github.com/millionco/react-doctor](https://github.com/millionco/react-doctor): React performance diagnostic tool already identified by Barry. Useful for Reviewer agent and admin/mobile performance review. How to use: integrate into reviewer QA workflow to detect expensive renders, unnecessary re-renders, and React performance regressions before marking editor features complete.