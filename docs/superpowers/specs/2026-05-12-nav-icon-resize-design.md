# Nav icon resize design

**Date:** 2026-05-12  
**Status:** Approved

## Problem

Navigation icons in `PrimaryRail` are `h-4 w-4` (16px) inside `h-9 w-9` (36px) buttons — icons occupy roughly 20% of the button area, making them appear small and hard to read at a glance.

## Decision

Scale up Lucide icons and their hit-area buttons in `PrimaryRail.tsx`. No icon library change, no new dependencies.

## Changes

**File:** `frontend/src/components/layout/PrimaryRail.tsx`

| Element | Before | After |
|---|---|---|
| `<nav>` width | `w-14` (56px) | `w-16` (64px) |
| `NavLink` button | `h-9 w-9` (36px) | `h-10 w-10` (40px) |
| `<Icon>` | `h-4 w-4` (16px) | `h-6 w-6` (24px) |
| Logo `<div>` | `h-9 w-9` (36px) | `h-10 w-10` (40px) |

Icons grow from 16px to 24px (1.5×). The button hit area grows from 36px to 40px to maintain comfortable padding around the icon. The rail widens from 56px to 64px to give the larger buttons 12px breathing room on each side.

All other styling (active state colors, hover states, tooltip placement, border) is unchanged.

## Out of scope

- Icon library change (Lucide outline stays)
- Text labels under icons
- MobileDrawer (no icons in that component)
- ContextPanel, AppShell (unaffected)
