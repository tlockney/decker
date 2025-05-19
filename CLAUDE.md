# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Repository Purpose

This is a Deno-based project for interacting with Elgato Stream Deck devices,
using the `@elgato-stream-deck/node` library. The project allows for detection,
connection, and control of Stream Deck hardware.

## Commands

- **Development**: `deno task dev` - Runs the main application with watch mode
  for automatic reloading
- **Run directly**: `deno run --allow-all main.ts` - Runs the application with
  all permissions

## Project Structure

- **main.ts**: Entry point for the application, currently lists connected Stream
  Deck devices
- **deno.json**: Configuration for Deno environment and dependencies

## Dependencies

- **@elgato-stream-deck/node**: Main library for Stream Deck interaction
- **@julusian/jpeg-turbo**: Used for image processing related to Stream Deck
  button displays

## Code Style

- Follow TypeScript best practices
- Use Deno's standard library and features when possible
- Maintain type safety throughout the codebase
