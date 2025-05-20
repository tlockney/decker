/**
 * Tests for Event System
 */

import { assertEquals } from "@std/assert";
import { EventBus } from "./events.ts";

Deno.test("EventBus handles regular subscriptions", () => {
  const bus = new EventBus();
  let callCount = 0;
  let lastData: unknown;

  const handler = (data: unknown) => {
    callCount++;
    lastData = data;
  };

  // Subscribe to event
  const unsubscribe = bus.on("test", handler);

  // Emit event
  bus.emit("test", "data1");
  assertEquals(callCount, 1);
  assertEquals(lastData, "data1");

  // Emit again
  bus.emit("test", "data2");
  assertEquals(callCount, 2);
  assertEquals(lastData, "data2");

  // Unsubscribe
  unsubscribe();

  // Emit after unsubscribe
  bus.emit("test", "data3");
  assertEquals(callCount, 2, "Handler should not be called after unsubscribe");
  assertEquals(lastData, "data2", "Last data should not change after unsubscribe");
});

Deno.test("EventBus handles once subscriptions", () => {
  const bus = new EventBus();
  let callCount = 0;

  const handler = () => {
    callCount++;
  };

  // Subscribe to event once
  bus.once("test", handler);

  // Emit event
  bus.emit("test", {});
  assertEquals(callCount, 1);

  // Emit again, should not trigger handler
  bus.emit("test", {});
  assertEquals(callCount, 1, "Once handler should only be called once");
});

Deno.test("EventBus handles multiple subscriptions", () => {
  const bus = new EventBus();
  let handler1Count = 0;
  let handler2Count = 0;

  const handler1 = () => handler1Count++;
  const handler2 = () => handler2Count++;

  // Subscribe both handlers
  bus.on("test", handler1);
  bus.on("test", handler2);

  // Emit event
  bus.emit("test", {});

  assertEquals(handler1Count, 1);
  assertEquals(handler2Count, 1);

  // Unsubscribe handler1
  bus.off("test", handler1);

  // Emit again
  bus.emit("test", {});

  assertEquals(handler1Count, 1, "Handler1 should not be called after unsubscribe");
  assertEquals(handler2Count, 2, "Handler2 should still be called");
});

Deno.test("EventBus handles errors in handlers", () => {
  const bus = new EventBus();
  let handler2Called = false;

  const handler1 = () => {
    throw new Error("Test error");
  };

  const handler2 = () => {
    handler2Called = true;
  };

  // Subscribe both handlers
  bus.on("test", handler1);
  bus.on("test", handler2);

  // Emit event - should not crash despite handler1 throwing
  bus.emit("test", {});

  assertEquals(handler2Called, true, "Handler2 should be called even if handler1 throws");
});

Deno.test("EventBus hasListeners works correctly", () => {
  const bus = new EventBus();

  assertEquals(bus.hasListeners("test"), false, "Should not have listeners initially");

  const handler = () => {};
  bus.on("test", handler);

  assertEquals(bus.hasListeners("test"), true, "Should have listeners after subscription");

  bus.off("test", handler);
  assertEquals(bus.hasListeners("test"), false, "Should not have listeners after unsubscription");
});

Deno.test("EventBus clearAllListeners works correctly", () => {
  const bus = new EventBus();
  let handlerCalled = false;

  const handler = () => {
    handlerCalled = true;
  };

  bus.on("test1", handler);
  bus.on("test2", handler);

  bus.clearAllListeners();

  bus.emit("test1", {});
  bus.emit("test2", {});

  assertEquals(handlerCalled, false, "Handlers should not be called after clearAllListeners");
});
