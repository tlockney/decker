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

## Creating New Examples

To create a new example:

1. Create a new TypeScript file in the examples directory
2. Make the file executable (`chmod +x your_example.ts`)
3. Add a shebang line to make it runnable: `#!/usr/bin/env -S deno run --allow-all`
4. Add the example to deno.json as a task: `"examples:myexample": "deno run --allow-all examples/your_example.ts"`