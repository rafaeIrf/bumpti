# Documentation Guidelines

## Creating New Documentation

When creating new documentation in the `docs/` directory:

1. **Create the markdown file** in `/docs/` with a descriptive name (kebab-case)
2. **Add comprehensive content** with clear sections, code examples, and diagrams where appropriate
3. **Link it in README.md** under the appropriate section:
   - **Architecture & Flows** - System design, data flows, pipelines
   - **Features & Implementation** - Feature-specific docs, setup guides, integrations
4. **Include description** - Add 1-line summary next to the link in README
5. **Use Mermaid diagrams** when visualizing flows or architecture
6. **Format consistently**:
   - Headers: Use `#` for title, `##` for major sections, `###` for subsections
   - Code blocks: Always specify language for syntax highlighting
   - Links: Use relative paths and descriptive link text

## Example

```markdown
### Architecture & Flows

- [My New Flow](docs/my-new-flow.md) - Brief description of what this doc covers
```

## Documentation Standards

- ✅ **DO:** Write concise, scannable content with clear sections
- ✅ **DO:** Include code examples and visual aids (diagrams, flowcharts)
- ✅ **DO:** Link to related files using relative paths
- ✅ **DO:** Keep docs up-to-date when code changes
- ❌ **DON'T:** Write walls of text without structure
- ❌ **DON'T:** Skip linking new docs in README
- ❌ **DON'T:** Duplicate information across multiple docs
