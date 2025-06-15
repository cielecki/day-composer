
## Life Navigator Style Guidelines

- Always check if there are existing styles in the appropriate CSS file that you can reuse
- If not, maybe you can make an existing style more general and reusable
- Never do inline styles, always use classes
- Favour general classes akin to tailwind rather than specific ones to a specific button or element
- Prefer simplicity - we want to keep the size of our CSS files in check
- **Multi-file structure**: We use separate CSS files for different components/views - check the file organization section for details

### Core Principles

#### 1. Hierarchy of Styles
Follow this order of preference:
1. **Utility Classes** - Reusable, single-purpose classes
2. **Component Classes** - Specific component styling
3. **Override Classes** - Specific overrides only when necessary

#### 2. Naming Conventions

##### Utility Classes (Preferred)
- Prefix: `ln-` 
- Pattern: `ln-{property}-{value}`
- Examples: `ln-flex`, `ln-gap-2`, `ln-text-sm`, `ln-bg-secondary`

##### Component Classes
- Prefix: `ln-{component}-`
- Pattern: `ln-{component}-{element}-{modifier?}`
- Examples: `ln-modal-header`, `ln-button-primary`, `ln-chat-input-disabled`

##### Legacy Classes (Avoid for new code)
- Pattern: `.life-navigator-view .specific-selector`
- Only use for existing code maintenance

#### 3. Design System Values

##### Spacing Scale
```css
--ln-space-1: 4px;   /* ln-gap-1, ln-p-1, ln-m-1 */
--ln-space-2: 8px;   /* ln-gap-2, ln-p-2, ln-m-2 */
--ln-space-3: 12px;  /* ln-gap-3, ln-p-3, ln-m-3 */
--ln-space-4: 16px;  /* ln-gap-4, ln-p-4, ln-m-4 */
--ln-space-5: 20px;  /* ln-gap-5, ln-p-5, ln-m-5 */
--ln-space-6: 24px;  /* ln-gap-6, ln-p-6, ln-m-6 */
--ln-space-8: 32px;  /* ln-gap-8, ln-p-8, ln-m-8 */
```

##### Font Sizes
```css
--ln-text-xs: 12px;  /* ln-text-xs */
--ln-text-sm: 14px;  /* ln-text-sm */
--ln-text-md: 16px;  /* ln-text-md (default) */
--ln-text-lg: 18px;  /* ln-text-lg */
--ln-text-xl: 20px;  /* ln-text-xl */
```

##### Border Radius
```css
--ln-radius-sm: 4px;  /* ln-rounded-sm */
--ln-radius-md: 6px;  /* ln-rounded */
--ln-radius-lg: 8px;  /* ln-rounded-lg */
--ln-radius-xl: 12px; /* ln-rounded-xl */
--ln-radius-full: 9999px; /* ln-rounded-full */
```

### 4. File Organization

#### Multi-File Structure
The project uses a multi-file CSS architecture for better organization and maintainability:

```
src/
├── styles.css              # Main entry point with imports
└── css/
    ├── setup.css           # Setup screen styles
    ├── system-prompt-view.css  # System prompt view styles
    ├── cost-analysis-view.css  # Cost analysis view styles
    └── life-navigator-view.css # Main life navigator view styles
```

#### Main Entry Point (src/styles.css)
```css
/* Life Navigator Plugin Styles */

@import "./css/setup.css";
@import "./css/system-prompt-view.css";
@import "./css/cost-analysis-view.css";
@import "./css/life-navigator-view.css";
```

#### Component File Structure
Each CSS file should follow this internal organization:

```css
/* 1. CSS Variables & Design Tokens (if needed) */
:root { ... }

/* 2. Component Base Styles */
.component-name {
    /* Base component styles */
}

/* 3. Component Variants */
.component-name-primary { ... }
.component-name-secondary { ... }

/* 4. Component States */
.component-name:hover { ... }
.component-name:disabled { ... }

/* 5. Responsive Overrides */
@media (max-width: 768px) {
    .component-name { ... }
}
```

#### When to Create New CSS Files

**Create a new CSS file when:**
- Building a new major view/component (e.g., `new-feature-view.css`)
- Component styles exceed 200+ lines
- Styles are logically separate from existing components
- Multiple developers work on the same component

**Add to existing files when:**
- Minor variations of existing components
- Utility classes that are widely used
- Small helper styles (under 50 lines)

#### File Naming Conventions
- Use kebab-case: `cost-analysis-view.css`
- Include component/view name: `{component-name}.css`
- For views: `{view-name}-view.css`
- For utilities: `utilities.css` or `helpers.css`

### 5. Utility-First Approach

#### Common Utilities to Always Use

##### Layout
```css
.ln-flex { display: flex; }
.ln-flex-col { flex-direction: column; }
.ln-items-center { align-items: center; }
.ln-justify-between { justify-content: space-between; }
.ln-gap-2 { gap: var(--ln-space-2); }
```

##### Spacing
```css
.ln-p-2 { padding: var(--ln-space-2); }
.ln-px-3 { padding-left: var(--ln-space-3); padding-right: var(--ln-space-3); }
.ln-m-0 { margin: 0; }
.ln-mt-4 { margin-top: var(--ln-space-4); }
```

##### Typography
```css
.ln-text-sm { font-size: var(--ln-text-sm); }
.ln-font-medium { font-weight: 500; }
.ln-text-muted { color: var(--text-muted); }
```

##### Background & Borders
```css
.ln-bg-secondary { background-color: var(--background-secondary); }
.ln-border { border: 1px solid var(--background-modifier-border); }
.ln-rounded { border-radius: var(--ln-radius-md); }
```

#### When to Create Component Classes

Only create component classes when:
1. You need 3+ utility classes together repeatedly
2. The component has specific interactive states
3. Complex styling that can't be achieved with utilities

##### Good Component Class Example
```css
.ln-button {
  /* Base styles that all buttons share */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--ln-space-2) var(--ln-space-4);
  border-radius: var(--ln-radius-md);
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;
  border: none;
}

.ln-button-primary {
  background-color: var(--interactive-accent);
  color: var(--text-on-accent);
}

.ln-button-secondary {
  background-color: transparent;
  color: var(--text-normal);
  border: 1px solid var(--background-modifier-border);
}
```

### 6. Responsive Design

#### Mobile-First Approach
```css
/* Base styles - mobile first */
.ln-modal { width: 100%; }

/* Tablet and up */
@media (min-width: 768px) {
  .ln-modal { width: 600px; }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .ln-modal { width: 800px; }
}
```

#### Common Responsive Utilities
```css
@media (max-width: 767px) {
  .ln-hidden-mobile { display: none; }
  .ln-flex-col-mobile { flex-direction: column; }
  .ln-text-sm-mobile { font-size: var(--ln-text-sm); }
}
```

### 7. Color Usage

#### Always Use CSS Variables
```css
/* Good */
.my-component {
  color: var(--text-normal);
  background-color: var(--background-secondary);
  border-color: var(--background-modifier-border);
}

/* Bad */
.my-component {
  color: #333;
  background-color: #f5f5f5;
  border-color: #ddd;
}
```

#### Semantic Color Classes
```css
.ln-text-normal { color: var(--text-normal); }
.ln-text-muted { color: var(--text-muted); }
.ln-text-accent { color: var(--text-accent); }
.ln-text-error { color: var(--text-error); }
.ln-text-success { color: var(--text-success); }
```

### 8. Animation & Transitions

#### Standard Transitions
```css
.ln-transition { transition: all 0.2s ease; }
.ln-transition-fast { transition: all 0.15s ease; }
.ln-transition-slow { transition: all 0.3s ease; }
```

#### Common Animations
```css
.ln-animate-spin { animation: spin 1s linear infinite; }
.ln-animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
.ln-animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
```

### 9. Before Adding New Styles - Checklist

1. **Can I use existing utility classes?**
   - Check existing `ln-*` utilities first
   
2. **Can I combine utilities?**
   ```html
   <!-- Instead of creating .my-special-container -->
   <div class="ln-flex ln-items-center ln-gap-3 ln-p-4 ln-bg-secondary ln-rounded">
   ```

3. **Is this used in 3+ places?**
   - If yes, create a component class
   - If no, use utilities

4. **Does it follow naming conventions?**
   - Utilities: `ln-{property}-{value}`
   - Components: `ln-{component}-{element}-{modifier?}`

5. **Am I using design system values?**
   - Use CSS variables for spacing, colors, fonts
   - Follow the established scales

### 10. Multi-File Development Workflow

#### Adding Styles to Existing Components
1. **Identify the correct file** - Find the CSS file that contains related styles
2. **Follow file organization** - Add styles in the appropriate section within the file
3. **Check for existing patterns** - Look for similar components in the same file
4. **Test imports** - Ensure your changes appear (styles.css imports the file)

#### Creating New Component CSS Files
1. **Create the file** in `src/css/` directory
2. **Add to imports** in `src/styles.css`:
   ```css
   @import "./css/your-new-component.css";
   ```
3. **Follow naming conventions** - Use kebab-case and descriptive names
4. **Include file header comment**:
   ```css
   /* Your Component Name Styles */
   ```

#### Development Best Practices
- **Hot reload works** - Changes to any CSS file trigger rebuild
- **Import order matters** - Place specific imports after general ones
- **Scope your styles** - Use appropriate class prefixes to avoid conflicts
- **Document complex components** - Add comments for non-obvious styling decisions

### 11. Refactoring Guidelines

#### Phase 1: Add Utilities (Safe)
Add new utility classes without changing existing styles:
```css
/* Add these to appropriate CSS file without breaking existing code */  
.ln-flex { display: flex; }
.ln-gap-2 { gap: 8px; }
.ln-p-3 { padding: 12px; }
```

#### Phase 2: Component Refactoring
Replace complex selectors with component classes:
```css
/* Before (in life-navigator-view.css) */
.life-navigator-view .some-complex .nested-selector {
  /* 10 lines of styles */
}

/* After (in appropriate component file) */
.ln-card {
  /* Same styles but reusable */
}
```

#### Phase 3: File Organization
- Move related styles to appropriate component files
- Remove unused styles and consolidate duplicates
- Update imports in styles.css if needed

### 12. Common Patterns

#### Modal Structure
```html
<div class="ln-modal-container">
  <div class="ln-modal-header ln-flex ln-items-center ln-gap-2 ln-p-4">
    <h2 class="ln-text-lg ln-font-medium ln-m-0">Title</h2>
  </div>
  <div class="ln-modal-content ln-p-4">
    Content
  </div>
  <div class="ln-modal-footer ln-flex ln-justify-end ln-gap-2 ln-p-4 ln-border-t">
    <button class="ln-button ln-button-secondary">Cancel</button>
    <button class="ln-button ln-button-primary">Confirm</button>
  </div>
</div>
```

#### Card Pattern
```html
<div class="ln-card ln-p-4 ln-bg-secondary ln-rounded ln-border">
  <div class="ln-card-header ln-flex ln-items-center ln-gap-2 ln-mb-3">
    <span class="ln-text-lg ln-font-medium">Title</span>
  </div>
  <div class="ln-card-content">
    Content here
  </div>
</div>
```

#### Button Groups
```html
<div class="ln-flex ln-gap-2">
  <button class="ln-button ln-button-primary">Primary</button>
  <button class="ln-button ln-button-secondary">Secondary</button>
</div>
```

### 13. Performance Considerations

1. **Minimize CSS bundle size**
   - Remove unused styles
   - Use shorthand properties
   - Avoid deep nesting

2. **Optimize selectors**
   - Prefer classes over complex selectors
   - Avoid universal selectors in components

3. **Use CSS custom properties**
   - Better for theming
   - Reduced bundle size
   - Dynamic updates

### 14. Tools & Automation

#### Recommended Practices
- Use CSS linting to enforce conventions
- Regular audits to remove unused styles
- Consider PostCSS for utility generation
- Use design tokens for consistency

This approach will make the styles much more maintainable, reusable, and easier to understand. The utility-first approach reduces specificity conflicts and makes the code more predictable. 
