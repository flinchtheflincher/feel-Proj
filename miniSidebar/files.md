# Project Files

Below is a list of all newly generated files and documentation logic defining the scope of this project.

1. `architecture.md`
   - **Purpose:** Describes the optimal architecture to operate the current minibar natively, including Database selection (IndexedDB / Chrome sync storage for caching logic per user browser), and local Application API usage logic (`http://localhost:11434/api/generate` connecting natively to local models). 

2. `skills/skills.md`
   - **Purpose:** Outlines the core hard logic (React, TypeScript, WebExtensions, fetch APIs, Ollama structure) and systems design required to maintain and scale this local isolated environment.  

3. `changes.md`
   - **Purpose:** An appendable log representing all actual code or document structure changes made to the previous boilerplate (removing useless redundant artifacts, modifying TypeScript service workers from stub arrays to actual fetch HTTP promises).

4. `files.md`
   - **Purpose:** Acts as a table of contents to quickly identify newly added scope documentation.

5. `files/src/background/index.ts`
   - **Purpose:** Modified to actively route user prompt events (AskSlmPayload) via POST commands specifically to the local AI environment without reliance on external packages or dependencies.
