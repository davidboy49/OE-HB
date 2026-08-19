<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:auditdesk-styling-rules -->
# UI Styling Rules
- When implementing single-select dropdowns, ALWAYS use the custom `<MultiSelect singleSelect={true}>` component rather than native `<select>` tags. This ensures a consistent, custom-styled dropdown experience (with search, padding, rounded borders, and custom background colors) across all forms without allowing multi-selection.
<!-- END:auditdesk-styling-rules -->
