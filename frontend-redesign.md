# Skill Manager Frontend Redesign Brief

This document defines the current product direction for the `skill-manager` frontend.

It is not a visual design guide. It is a product-surface brief that clarifies:

- the project background
- the intended user
- the problem the product solves
- the updated page and interaction plan

## Project Background

`skill-manager` is a local-first application for managing skills across multiple agent harnesses from one place.

Today, skills are spread across different local tools, each with its own storage model, enablement behavior, and built-in versus user-installed distinction. The project already has a Python backend that scans harnesses, merges skill discoveries, manages a shared store, centralizes local skills, enables and disables managed skills, installs from external sources, updates source-backed skills, and exposes all of that through a local API. The browser UI is the primary product surface.

The original frontend was useful as a bootstrap shell, but it still reflects implementation buckets more than user jobs. Pages such as `Setup` and `Health` expose too much operational detail directly and create more navigation and mental switching than necessary.

The redesign should make the product feel like a simple skill manager rather than a developer console for internal mechanics.

## Intended User

The primary user is an individual developer or AI-tool power user who uses multiple local agent harnesses and wants one place to understand and manage skills across them.

This user:

- already understands what a skill is
- may use more than one harness on the same machine
- wants simple management, not infrastructure details
- wants to know what is installed, what is active, and what needs action
- does not want to manually reason about filesystem layout, source metadata, or sync mechanics

The product should also remain usable for a more technical operator, but advanced details should be secondary and not the default view.

## Problem Background

The product exists because skill management is currently fragmented.

### Current user pain

- skills are scattered across different harnesses
- there is no single place to see what is available and where it is active
- enabling or disabling a skill depends on harness-specific behavior
- skills discovered locally may or may not already be under management
- the difference between built-in, shared, local, and modified skills is hard to understand
- update and conflict behavior can become mentally expensive if the model is too technical

### What the frontend should solve

The frontend should help the user answer five questions quickly:

1. What skills do I have?
2. Which tools can use each skill?
3. Which skills are already managed by the app?
4. Which skills need action from me?
5. How do I add a new skill?

### What the frontend should not force the user to learn

The frontend should not require the user to understand:

- raw source locators
- revision fingerprints
- discovery modes
- path resolution details
- link or symlink behavior
- low-level integrity check output

Those are implementation details and should stay backend-side unless the user explicitly opens advanced diagnostics.

## Updated Product Model

To keep the mental model simple, the frontend should use a small set of user-facing skill states.

### Skill states

- `Managed`
  - The app owns this skill and can manage it directly.
- `Found locally`
  - The skill exists in one or more harnesses but is not yet under app management.
- `Custom`
  - A managed skill has been modified locally and should no longer be treated as updateable from its original source.
- `Built-in`
  - The skill is provided by a harness and is visible, but not managed by this app.
- `Needs review`
  - Reserved for rare ambiguous cases that cannot be simplified automatically.

### Update and customization rule

The product should adopt the following simplified rule set:

- Same source plus same content means the app treats discoveries as the same skill.
- Same source plus different content means the changed version becomes a `Custom` skill instead of a conflict.
- Only unmodified source-backed managed skills are updateable.
- Custom skills do not have source updates.

This removes most conflict handling from the main user workflow and makes the product easier to understand.

## Updated Page Plan

The frontend should have three user-facing surfaces and one shared detail surface.

### 1. Skills

This is the primary workspace and default landing area.

Purpose:

- separate ongoing management from local intake
- keep both workflows under one top-level `Skills` product surface
- let the user switch between operating managed skills and reviewing local discoveries without leaving context

#### Workspace structure

The `Skills` workspace should have two route-backed subviews:

- `Managed`
- `Found locally`

A shared tab bar sits under the workspace header.

### Managed

Purpose:

- operate skills already owned by the shared store
- toggle per-tool availability
- review custom modifications
- access the detail drawer for deeper actions

#### Main layout

The core layout is a dense card-row control list.

- each skill is represented as one management record
- the top band contains operational controls
- the bottom band contains a short description
- built-ins can appear as a separate secondary reference section when explicitly revealed

#### Row behavior

- grouped per-harness toggles stay in this page only
- the primary action is `Details` or another managed-only action such as update when available
- `Bring under management` does not belong here

#### Page-level actions

- optional built-in reveal
- optional route to `Found locally` when intake items exist

### Found locally

Purpose:

- review unmanaged skills detected in local tool folders
- decide what to centralize into the shared store
- run bulk intake actions

#### Main layout

The layout is a simpler intake list, not a toggle matrix.

- rows emphasize identity, short description, and where the skill was found
- the primary action is `Bring under management`
- details still open in the shared drawer

#### Page-level actions

- primary bulk action: `Bring all eligible skills under management`
- search and tool filters

#### What does not belong here

- per-tool enable/disable toggles
- managed-state operational controls

### 2. Marketplace

This is the acquisition page.

Purpose:

- help the user discover and install new skills

#### Main responsibilities

- show popular skills from all supported sources
- support search across supported sources
- normalize results into one display model
- let the user install a skill into managed storage

#### Default sorting

Since the current source model can resolve to GitHub, the default ranking can use GitHub stars.

Official skills should be distinguishable from community results, but the page should still feel like one unified marketplace rather than separate source silos.

#### Result display model

Each marketplace item should have a uniform summary:

- name
- short description
- source label
- official or community label
- popularity

YAML or source-specific formatting should be normalized in the backend before being shown in the UI.

### 3. Settings

This is a secondary maintenance surface, not a primary workflow page.

Purpose:

- hold advanced and maintenance-related controls

#### Responsibilities

- show detected harnesses and availability
- allow rescan
- hold source preferences
- expose advanced diagnostics when needed
- optionally duplicate bulk maintenance actions such as `Bring all eligible skills under management`

The page should exist, but it should not compete with `Skills` as the main place where the product is used.

### 4. Skill Details Panel

This is a shared side panel or drawer that opens from both `Managed` and `Found locally`.

Purpose:

- show richer skill information without making the main list heavy

#### Responsibilities

- show full description
- show source summary
- show user-facing skill type (`Managed`, `Found locally`, `Custom`, `Built-in`)
- show harness availability and bindings
- show whether the skill is updateable
- show advanced details only when expanded

This panel is also the right place to explain why a skill is considered custom and why it may no longer receive source updates.

## Conflicts and Review

The redesign should avoid making conflict management a primary workflow unless truly necessary.

### Default handling

- identical discoveries collapse automatically
- locally modified managed skills become `Custom`
- only rare unresolved edge cases become `Needs review`

### UI implication

- no dedicated conflict page is required in the first redesign
- the main `Skills` list only needs a small user-facing review state
- any real review flow can open from a detail panel or separate focused interaction later

## Frontend and Backend Responsibility Split

The redesign should intentionally move interpretation work into the backend.

### Backend should decide

- whether a skill is `Managed`, `Found locally`, `Custom`, `Built-in`, or `Needs review`
- whether a skill is updateable
- whether bulk centralization is allowed
- whether a skill needs user attention
- how marketplace results are normalized and ranked

### Frontend should render

- the user-facing status
- the user-facing recommended action
- the harness toggles
- the unified marketplace view
- optional advanced details only when requested

The frontend should render a clean management experience, not expose backend classification internals directly.

## Backend Alignment Requirement

The redesigned frontend does not require a deep backend rewrite first. The current `Skills` read model is sufficient for the card-row management surface, and backend work should now focus on future product refinements rather than blocking this UI structure.

### What is already supported

The backend already supports the core mechanics needed for the simplified product:

- unified catalog scan and merge
- per-skill enable and disable for managed skills
- per-skill centralization
- bulk centralization
- marketplace search and install
- source-backed update flow

This means the planned card-row `Skills` page is mechanically feasible with the current backend.

### What may still need refinement later

The current backend contract is good enough for the main list refactor, but some product-facing semantics can still improve over time:

- display status (`Managed`, `Found locally`, `Custom`, `Built-in`, `Needs review`)
- whether a skill is updateable
- whether a skill is a custom variant
- whether a skill needs user attention
- whether a skill is eligible for bulk centralization
- normalized marketplace popularity and source labeling

### Implementation posture

The right approach is:

- keep the current store, harness, and mutation core
- keep the current `Skills` API contract for the card-row refactor
- refine backend semantics later only where the product model genuinely needs it

## Updated Plan

### Step 1. Lock the user-facing product model

Define and adopt the final user-facing states:

- `Managed`
- `Found locally`
- `Custom`
- `Built-in`
- `Needs review`

Define the update rule:

- only unmodified source-backed managed skills are updateable
- modified managed skills become custom

### Step 2. Keep the backend contract stable for the Skills refactor

Use the current frontend-oriented backend contract for the list rewrite.

Backend follow-up can continue later for:

- `Custom` classification refinement
- updateability rules
- bulk-centralize eligibility
- normalized marketplace ranking inputs

### Step 3. Simplify the frontend information architecture

Replace the current multi-bucket mental model with:

- `Skills` workspace
- `Managed`
- `Found locally`
- `Marketplace`
- `Settings`
- shared `Skill details panel`

Retire `Setup` and `Health` as primary user workflows.

### Step 4. Split the `Skills` workspace by workflow

Implement `Skills` as one workspace with two subviews:

- `Managed`: dense control-plane card rows with grouped harness toggles
- `Found locally`: intake records with discovery context and management CTA
- shared detail drawer across both
- bulk centralization action only in `Found locally`

### Step 5. Narrow the default information shown in the UI

Keep the default UI focused on decisions and actions.

Hide backend-only details by default, including:

- raw source locators
- revision hashes or fingerprints
- discovery internals
- raw integrity output

### Step 6. Normalize the marketplace

Make marketplace results uniform across sources:

- one summary format
- one popularity ranking model
- official versus community labeling
- one install action

### Step 7. Move advanced behavior behind secondary surfaces

Keep advanced and maintenance functionality out of the primary workflow:

- diagnostics live in `Settings`
- rare review cases open from a focused panel
- full skill metadata lives in the detail panel instead of the main list

## Success Criteria

The redesign is successful if a user can do the following with very low mental overhead:

1. open the app and immediately understand which skills exist
2. understand whether they should operate a managed skill or review a local discovery
3. toggle skill availability per harness from the managed view
4. bring found local skills under management from the intake view without learning backend terms
5. install new skills from one normalized marketplace
6. understand modified skills as `Custom` rather than as a complicated conflict model

If the app still requires users to reason about implementation details in the default flow, the redesign has not gone far enough.
