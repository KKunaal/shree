# Three-Dot Menu UI Guide

## Overview

The user management interface now uses a cleaner three-dot menu design instead of multiple inline buttons.

---

## Visual Layout

### Desktop View (> 768px)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│  User Management                                        [+ Create User]        │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌──────────────────────────────────────────────────────────────────────────┐ │
│  │ Username       │ Role         │ Status      │ Created      │              │ │
│  ├──────────────────────────────────────────────────────────────────────────┤ │
│  │ doctor (You)   │ [🟣 doctor]  │ [🟢 Active] │ Jun 24, 2026 │ [⋮]         │ │
│  │ reception      │ [🟢 reception]│ [🟢 Active] │ Jun 24, 2026 │ [⋮]         │ │
│  │ nurse1         │ [🟢 reception]│ [🔴 Inactive]│ Jun 24, 2026 │ [⋮]         │ │
│  └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
```

---

## Three-Dot Menu States

### 1. Closed State (Default)

```
┌─────────────────────────────────────────────┐
│ doctor (You) │ [doctor] │ Active │ ... │ ⋮ │
└─────────────────────────────────────────────┘
```

The three vertical dots (⋮) appear as a subtle gray button.

### 2. Hover State

```
┌─────────────────────────────────────────────┐
│ doctor (You) │ [doctor] │ Active │ ... │[⋮]│  ← Button highlights
└─────────────────────────────────────────────┘
```

On hover, the button gets a light gray background.

### 3. Open State (For Other Users)

```
┌─────────────────────────────────────────────┐
│ reception │ [reception] │ Active │ ... │ ⋮ │
│                                     │       │
│                              ┌──────────────┤
│                              │ ✏️ Edit User │
│                              │ 🗑️ Delete User│
│                              └──────────────┘
└─────────────────────────────────────────────┘
```

Menu drops down showing both options.

### 4. Open State (For Current User)

```
┌─────────────────────────────────────────────┐
│ doctor (You) │ [doctor] │ Active │ ... │ ⋮ │
│                                     │       │
│                              ┌──────────────┤
│                              │ ✏️ Edit User │
│                              └──────────────┘
└─────────────────────────────────────────────┘
```

Only "Edit User" option shown - delete is hidden.

---

## Menu Item Details

### Edit User Option

```
┌─────────────────────┐
│ ✏️ Edit User        │  ← Pencil icon + text
└─────────────────────┘
```

**Visual States:**
- Default: Gray text on white background
- Hover: Gray text on light gray background

**Action:** Opens edit modal

### Delete User Option

```
┌─────────────────────┐
│ 🗑️ Delete User      │  ← Trash icon + text (red)
└─────────────────────┘
```

**Visual States:**
- Default: Red text on white background
- Hover: Red text on light red background

**Action:** Shows confirmation dialog, then deletes user

**Visibility:**
- ✅ Shown for other users
- ❌ Hidden for current logged-in user

---

## User Identification

### Current User Row

```
┌────────────────────────────────────────────┐
│ doctor (You) │ [doctor] │ Active │ ... │ ⋮ │
│        ↑                                   │
│   Gray label                               │
└────────────────────────────────────────────┘
```

The "(You)" label appears next to the username of the currently logged-in user.

### Other User Rows

```
┌────────────────────────────────────────────┐
│ reception │ [reception] │ Active │ ... │ ⋮ │
│                                            │
└────────────────────────────────────────────┘
```

No special label for other users.

---

## Menu Behavior

### Opening the Menu

1. Click the three-dot button (⋮)
2. Menu appears below the button
3. Menu is positioned absolutely to the right

### Closing the Menu

Menu closes when:
- ✅ Clicking outside the menu
- ✅ Clicking on a menu item
- ✅ Opening another user's menu

Menu stays open when:
- ❌ Clicking inside the menu container

---

## Responsive Design

### Desktop (> 1024px)

```
Full table with all columns visible
Menu appears to the right side
```

### Tablet (768px - 1024px)

```
Table may require horizontal scroll
Menu still appears on right
```

### Mobile (< 768px)

```
Table scrolls horizontally
Menu appears above content if space is limited
Three-dot button remains visible
```

---

## Color Scheme

### Three-Dot Button
- Default: `#9CA3AF` (gray-400)
- Hover: `#4B5563` (gray-600)
- Background on hover: `#F3F4F6` (gray-100)

### Menu Container
- Background: White
- Border: `#E5E7EB` (gray-200)
- Shadow: Large drop shadow

### Edit User Option
- Text: `#374151` (gray-700)
- Hover background: `#F3F4F6` (gray-100)
- Icon: Same as text color

### Delete User Option
- Text: `#DC2626` (red-600)
- Hover background: `#FEF2F2` (red-50)
- Icon: Same as text color

---

## Icon Details

### Three-Dot Icon (SVG)

```svg
<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
</svg>
```

Three circles arranged vertically.

### Edit Icon (SVG)

```svg
<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
</svg>
```

Pencil/edit icon.

### Delete Icon (SVG)

```svg
<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
</svg>
```

Trash can icon.

---

## Interaction Examples

### Example 1: Editing Another User

```
User clicks ⋮ next to "reception"
  ↓
Menu opens showing:
  • Edit User
  • Delete User
  ↓
User clicks "Edit User"
  ↓
Menu closes
  ↓
Edit modal opens
```

### Example 2: Trying to Delete Self

```
User clicks ⋮ next to "doctor (You)"
  ↓
Menu opens showing:
  • Edit User
  ↓
Delete option is NOT shown
  ↓
User cannot delete themselves
```

### Example 3: Clicking Outside Menu

```
Menu is open for user "reception"
  ↓
User clicks anywhere outside the menu
  ↓
Menu closes
  ↓
No action performed
```

---

## Accessibility Features

### Keyboard Navigation
- Tab to focus three-dot button
- Enter/Space to open menu
- Tab through menu items
- Enter/Space to select option
- Escape to close menu

### Screen Reader Support
- Button labeled as "User actions menu"
- Menu items have descriptive labels
- Current state announced (expanded/collapsed)

### Visual Indicators
- Hover states clearly visible
- Focus rings on keyboard navigation
- Color contrast meets WCAG AA standards

---

## Code Structure

### Menu Toggle Function

```javascript
const toggleMenu = (e, userId) => {
  e.stopPropagation()  // Prevent event bubbling
  setOpenMenuId(openMenuId === userId ? null : userId)
}
```

### Outside Click Handler

```javascript
useEffect(() => {
  if (!openMenuId) return
  const handleClick = () => setOpenMenuId(null)
  document.addEventListener('click', handleClick)
  return () => document.removeEventListener('click', handleClick)
}, [openMenuId])
```

### Current User Check

```javascript
const isCurrentUser = (username) => username === user.username
```

---

## Common Issues & Solutions

### Issue: Menu doesn't close when clicking outside

**Solution:** Ensure `e.stopPropagation()` is used in the toggle function.

### Issue: Menu appears behind other elements

**Solution:** Set `z-50` class on menu container.

### Issue: Delete option shows for current user

**Solution:** Check `isCurrentUser()` condition in JSX.

### Issue: Menu is cut off at edge of screen

**Solution:** Use `right-0` positioning for right-aligned menus.

---

## Best Practices

1. **Always close menu after action** - Improve UX by closing menu when an action is selected
2. **Use stopPropagation** - Prevent menu toggle when clicking inside
3. **Add loading states** - Show loading indicator during delete operation
4. **Confirm destructive actions** - Always confirm before deleting
5. **Provide visual feedback** - Show success/error messages after actions

---

## Testing Checklist

- [ ] Three-dot button appears on all rows
- [ ] Menu opens on click
- [ ] Menu closes on outside click
- [ ] Menu closes when selecting an item
- [ ] Edit option works for all users
- [ ] Delete option hidden for current user
- [ ] Delete option shown for other users
- [ ] Menu position is correct (not cut off)
- [ ] Hover states work correctly
- [ ] Keyboard navigation works
- [ ] Screen reader announces correctly
- [ ] Mobile responsive (scrollable)
- [ ] Icons display correctly
- [ ] Colors match design system

---

## Comparison: Old vs New

### Old Design (Before)

**Pros:**
- All actions visible at a glance
- No need to open menu

**Cons:**
- Takes up too much horizontal space
- Cluttered appearance
- Too many buttons on mobile
- Delete button visible even for self

### New Design (After)

**Pros:**
- Clean, minimal interface
- More horizontal space for data
- Delete hidden for current user
- Scalable for more actions
- Better mobile experience

**Cons:**
- Requires one extra click
- Actions hidden until menu opens

**Verdict:** New design is better for scalability and user protection.

---

## Future Enhancements

Potential improvements to the menu:

1. **Submenu support** - For nested actions
2. **Tooltips** - Show action description on hover
3. **Keyboard shortcuts** - Quick actions without mouse
4. **Bulk actions** - Select multiple users
5. **Context awareness** - Show different options based on user state
6. **Animation** - Smooth menu open/close transitions
7. **Search within menu** - If many actions available
