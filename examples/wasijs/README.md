Example of loading WASI program in JS


# wasijs

It is a wasm binary file transormation util that:

  1. Converts "memory" into imports, and read it type details (initial, maximum, etc.)
  2. (TBD?) If "wasi_snapshot_preview1" import has `i64` in the parameters, create a trampoline to have two i32.

Build wasijs.wasm: `cargo build --target=wasm32-unknown-unknown --release`

# test.js

It is an example loader for for wasm with "wasi_snapshot_preview1" imports. The loader transforms wasm (see above) and creates a memory based of the reported memory type.

