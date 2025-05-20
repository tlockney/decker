# Decker Examples

This directory contains example applications demonstrating various features of the Decker library.

## Running Examples

You can run any example using the Deno CLI directly or with the provided tasks in deno.json.

### Rendering System Example

Demonstrates the button rendering capabilities, including text, colors, and images.

```bash
# Using the task
deno task examples:rendering

# Or directly
deno run --allow-all examples/rendering_examples.ts
```

### State Rendering Example

Demonstrates the integration of the state management system with the rendering system.

```bash
# Using the task
deno task examples:state

# Or directly
deno run --allow-all examples/state_rendering_example.ts
```

### Action Framework Example

Demonstrates the action framework and its integration with the button state system.

```bash
# Using the task
deno task examples:actions

# Or directly
deno run --allow-all examples/action_framework_example.ts
```

## Example Descriptions

### Rendering Examples (`rendering_examples.ts`)

This example demonstrates the button rendering system:

1. Connects to available Stream Deck devices
2. Sets up different rendering examples
3. Cycles through rendering examples when buttons are pressed:
   - Example 1: Solid colors
   - Example 2: Simple text
   - Example 3: Colored text
   - Example 4: Image loading
   - Example 5: Programmatically generated patterns

### State Rendering Examples (`state_rendering_example.ts`)

This example demonstrates the integration of state management with rendering:

1. Creates a configuration with multiple pages of buttons
2. Sets up the state manager with the configuration
3. Connects the state manager to the rendering system with the state renderer
4. Demonstrates page switching functionality
5. Shows how stateful buttons maintain their state across interactions
6. Provides visual feedback for button presses

### Action Framework Examples (`action_framework_example.ts`)

This example demonstrates the action framework and state integration:

1. Implements three custom action types:
   - Counter: Increments a counter on button press
   - Delayed: Performs a countdown with visual feedback (cancellable)
   - Toggle: Toggles the button state with color changes
2. Sets up the action registry and registers action factories
3. Creates the action executor to handle action execution
4. Integrates actions with the button state system
5. Shows visual feedback for action progress, success, and failure

## Creating New Examples

To create a new example:

1. Create a new TypeScript file in the examples directory
2. Make the file executable (`chmod +x your_example.ts`)
3. Add a shebang line to make it runnable: `#!/usr/bin/env -S deno run --allow-all`
4. Add the example to deno.json as a task: `"examples:myexample": "deno run --allow-all examples/your_example.ts"`
