#!/usr/bin/env -S deno run --allow-all

import { openStreamDeck, listStreamDecks } from '@elgato-stream-deck/node'

// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
  console.log("Initializing StreamDeck...");
	// List the connected streamdecks
	const devices = await listStreamDecks()
	if (devices.length === 0) throw new Error('No streamdecks connected!')

	devices.forEach((device) => {
		console.log('Found device:', device)
	})

	const streamDeck = await openStreamDeck(devices[0].path);

	streamDeck.on('down', (control) => {
		console.log('key down', control)

		if (control.type !== 'button') return

		console.log('Filling button #%d', control.index)
		streamDeck.fillKeyColor(control.index, 255, 0, 0).catch((e) => console.error('Fill failed:', e))
	})

	streamDeck.on('up', (control) => {
		console.log('key up', control)

		if (control.type !== 'button') return

		// Clear the key when it is released.
		console.log('Clearing button #%d', control.index)
		streamDeck.clearKey(control.index).catch((e) => console.error('Clear failed:', e))
	})

	streamDeck.on('error', (error) => {
		console.error(error)
	})
}
