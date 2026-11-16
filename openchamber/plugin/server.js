// DeepShift — the OpenCode plugin half that ships inside the OpenChamber
// extension, so one install covers both clients.
//
// OpenCode loads this file with a bare import() from this folder, where nothing
// is installed — so it has no imports and only carries the plugin identity.
// The GUI half (./gui-experimental) is a build artifact: `npm run
// build:openchamber` copies opencode/gui.cjs (built from opencode/gui.cts) here.

export default {
	id: 'deepshift',
	setup() {},
};
