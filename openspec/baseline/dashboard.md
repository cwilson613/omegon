# Dashboard — Implementing/Implemented Rendering

### Requirement: Clickable Design Tree dashboard items

Design Tree items rendered by the dashboard must expose clickable OSC 8 links when the underlying design document path is known.

#### Scenario: Design footer entry opens the design document

Given a Design Tree dashboard item with a known markdown file path
And mdserve is running for the project root
When the dashboard renders the Design Tree item in the footer or overlay
Then the item text is wrapped in an OSC 8 link
And the link target is the mdserve HTTP URL for that markdown file

#### Scenario: Design footer entry falls back to file URI

Given a Design Tree dashboard item with a known markdown file path
And mdserve is not running
When the dashboard renders the Design Tree item in the footer or overlay
Then the item text is wrapped in an OSC 8 link
And the link target is a file:// URI for that markdown file

### Requirement: Clickable OpenSpec dashboard items

Top-level OpenSpec change items rendered by the dashboard must expose clickable OSC 8 links when the change directory is known.

#### Scenario: OpenSpec change opens proposal by default

Given an OpenSpec dashboard change with a known change directory
And a proposal.md file exists in that change directory
When the dashboard renders the top-level OpenSpec change item
Then the change name is wrapped in an OSC 8 link
And the link target is the resolved URI for proposal.md in that change directory

#### Scenario: OpenSpec change stays plain when no proposal exists

Given an OpenSpec dashboard change without a proposal.md file
When the dashboard renders the top-level OpenSpec change item
Then the change name is rendered without an OSC 8 link

### Requirement: Shared URI resolver consistency

Dashboard links must use the same URI resolution rules as the view tool so markdown routes to mdserve when available and degrades gracefully otherwise.

#### Scenario: Dashboard link generation delegates to the shared resolver

Given the dashboard renders a clickable item for a known file path
When the dashboard computes the URI target
Then it uses the shared URI resolver module
And it passes the current mdserve port when available
