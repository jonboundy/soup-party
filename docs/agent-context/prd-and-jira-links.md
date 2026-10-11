# Prd and jira links

**PRD (source of truth):** "Soup Party — Product & Technical Specification"
https://jonboundy.atlassian.net/wiki/spaces/SP/pages/28803073/Soup+Party+Product+Technical+Specification
- Confluence space `SP`, page ID `28803073`, no child pages (as of 2026-10-10).
- Fetch with `mcp__claude_ai_Atlassian_Rovo__getConfluencePage`, `cloudId: "jonboundy.atlassian.net"`, `pageId: "28803073"`, `contentFormat: "markdown"`.

**Jira:** project key `SP`, board 204
https://jonboundy.atlassian.net/jira/software/projects/SP/boards/204
- Query with `mcp__claude_ai_Atlassian_Rovo__searchJiraIssuesUsingJql`, `cloudId: "jonboundy.atlassian.net"`. Restrict `fields` (e.g. summary, status, issuetype, priority, parent, labels) — an unrestricted project-wide search overflows the tool result limit.
- Labels: `v1-0` and `v1-1` mark the milestone.

The memories [product vision](product-vision.md), [scope and tickets](scope-and-tickets.md), [architecture](architecture.md), and [open decisions](open-decisions.md) are a snapshot of the PRD as read on 2026-10-10 (PRD status then: "Initial implementation reference"). Re-fetch the page when exact wording matters or if the snapshot looks stale.
