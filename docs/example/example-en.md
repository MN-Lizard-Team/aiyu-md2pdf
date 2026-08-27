---
title: "Example Document"
subtitle: "Markdown to PDF + Word Template"
author: "Author Name"
date: "27 August 2026"
document: "Template Example"
---

\newpage

# Document Overview

This document demonstrates **aiyu-md2pdf** — a tool to convert Markdown into PDF and Word with Mermaid diagrams.

## Features

- **Thai & English support** — Sarabun font (Google Fonts)
- **Mermaid diagrams** — auto-rendered to high-resolution images
- **PDF + Word** — generates both formats simultaneously
- **Table of Contents** — automatic, with numbered headings
- **Figure captions** — "Figure X.Y: diagram name" auto-generated
- **Centered diagrams** — images centered on the page
- **Page breaks** — `## x.x` sections start on a new page

## Usage

1. Place `.md` files in the `docs/` folder
2. Run `./build.sh`
3. PDF and DOCX files are generated in the root folder

\newpage

# Diagram Examples

## Flowchart

Example of a flowchart:

```mermaid
graph TD
    A[Start] --> B{Check condition}
    B -->|Yes| C[Process]
    B -->|No| D[Skip]
    C --> E[End]
    D --> E
```

## Sequence Diagram

Example of a sequence diagram:

```mermaid
sequenceDiagram
    participant U as User
    participant S as Server
    participant D as Database
    U->>S: Send request
    S->>D: Query
    D-->>S: Result
    S-->>U: Response
```

## ER Diagram

Example of an entity-relationship diagram:

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains
    CUSTOMER {
        string name
        string email
    }
    ORDER {
        int order_number
        string delivery_address
    }
```

\newpage

# Configuration

## Mermaid Theme

Edit `mermaid-theme.txt` to change colors, font size, and diagram style.

## LaTeX Preamble

Edit `preamble.tex` to change:
- Document font
- Heading styles
- Header / Footer
- Image size
- Page layout

## Word Template

Edit `reference.docx` to change Word output styles.
