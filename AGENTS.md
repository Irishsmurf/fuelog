# Agent Guidelines for Working with This Repository

This document provides guidelines for AI agents (like you!) when making changes or adding features to this project.

## General Workflow for Adding New Features

1.  **Understand the Requirements:** Thoroughly analyze the user's request. If anything is unclear, ask for clarification before proceeding.
2.  **Explore the Codebase:** Identify relevant files and understand the existing architecture. Pay attention to `README.md` files in specific directories and any other `AGENTS.md` files in subdirectories, as they may contain more specific instructions.
3.  **Formulate a Plan:** Outline the steps you'll take to implement the feature. Use the `set_plan` tool for this.
4.  **Implement Incrementally:** Make changes in small, logical steps.
5.  **Test Thoroughly:**
    *   Write unit tests for new functionality where appropriate.
    *   Perform manual testing (simulated or actual, if possible) to ensure the feature works as expected and doesn't break existing functionality.
6.  **Consider Feature Flags:** For significant new UI elements or behavioral changes, consider using feature flags (managed via Firebase Remote Config, see `src/firebase/AGENTS.md` and `src/firebase/remoteConfigService.ts`) to allow for phased rollouts or quick disabling if issues arise.

## Development Environment & Build Process

Before committing any changes, and especially when adding new dependencies or features, ensure the following:

1.  **Install Dependencies:**
    *   If you've added new packages or if this is your first time working on the project, run:
        ```bash
        npm install
        ```
    *   This ensures all necessary dependencies are available.

2.  **Build the Project:**
    *   After making your code changes, always run the build command to ensure the project compiles successfully:
        ```bash
        npm run build
        ```
    *   Address any build errors before submitting your changes.

## Submitting Changes

*   Use descriptive commit messages.
*   If you created a feature flag, remind the user to configure it in the Firebase Remote Config console.
*   Ensure all steps in your plan are complete.

By following these guidelines, you'll help maintain the quality and stability of this codebase. Thank you!
