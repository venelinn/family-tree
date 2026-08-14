---
name: add-style-rule
description: Add or update CSS/SCSS styling guide rules for the boats-web project. Use when the user wants to add a new styling convention, CSS rule, SCSS pattern, design token guideline, or update existing style rules. Handles writing to the correct rule file.
---

# Add Style Rule

Add new styling conventions to the project's cursor rules. Rules are persisted in `.cursor/rules/css-styling.mdc` so all agents and sessions follow them.

## Instructions

1. **Read the current rules file** at `.cursor/rules/css-styling.mdc`
2. **Determine where the new rule belongs** by matching to an existing section:

| Section | What goes here |
|---------|---------------|
| Absolute Rules | Hard constraints (never do X, always do Y) |
| Design Tokens | Token usage, variables, Style Dictionary |
| CSS Modules | Module conventions, imports, clsx |
| BEM Methodology | Class naming, nesting, modifiers |
| Responsive | Media queries, container queries, mobile-first |
| Layout Patterns | Grid, flexbox, sizing patterns |
| Units | rem, px, em, token vars |
| File Structure | Import order, file conventions |

3. **If no section fits**, create a new `## Section` at the end (before `## File Structure`)
4. **Write the rule** following these formatting conventions:
   - Use `- ` bullet points for each rule
   - Bold the key constraint: `- **Never use X** — do Y instead`
   - Include a code example if the rule involves syntax:

```scss
// ❌ BAD
.card { color: #333; }

// ✅ GOOD
.card { color: var(--color-main); }
```

5. **Append** the rule to the appropriate section using StrReplace — never rewrite the entire file
6. **Confirm** the addition to the user with a brief summary

## Rules for Writing Rules

- Keep each rule to 1-2 lines max
- Be specific — "never use X" is better than "avoid X when possible"
- Include the WHY if it's not obvious
- If the rule has exceptions, state them inline
- Don't duplicate existing rules — check first
