const fs = require('fs');

function initWasiObject(manifest) {
    let memory_desc = {
        initial: manifest.memory.initial,
        shared: manifest.memory.shared,
    };
    if (manifest.memory.maximum != null) {
        memory_desc.maximum = manifest.memory.maximum;
    }
    const memory = new WebAssembly.Memory(manifest.memory);
    const imports = {
        wasi_js: {
            memory,
        },
        wasi_snapshot_preview1: {
            proc_exit() { throw "proc_exit"; },
            fd_write(fd, iovs_ptr, iovs_len, nwritten_out) {
                let out;
                switch (fd) {
                    case 1: out = process.stdout; break;
                    case 2: out = process.stderr; break;
                    default: return 8;
                }

                const v = new DataView(memory.buffer);
                let nwritten = 0;
                for (let i = 0; i < iovs_len; i++) {
                  const data_ptr = v.getUint32(iovs_ptr + 0, true);
                  const data_len = v.getUint32(iovs_ptr + 4, true);
                  const data = new Uint8Array(memory.buffer, data_ptr, data_len);
                  iovs_ptr += 4;
                  nwritten += data_len;
                  
                  out.write(Buffer.from(data).toString());
                }
                v.setUint32(nwritten_out, nwritten, true);
            },
            fd_prestat_get() { return 8; },
            fd_prestat_dir_name() { throw "fd_prestat_dir_name"; },
            environ_sizes_get(p_argc, p_argv_buf_size) {
                const v = new DataView(memory.buffer);
                v.setUint32(p_argc, 0, true);
                v.setUint32(p_argv_buf_size, 0, true);
            },
            environ_get() { throw "environ_get"; },
        },
    };
    return imports;
}

let wasijs_cached;

// Loader for wasm with "wasi_snapshot_preview1" imports.
async function instantiateWasi(wasm) {
    if (!wasijs_cached) {
        wasijs_cached = fs.readFileSync("target/wasm32-unknown-unknown/release/wasijs.wasm");
    }

    const { instance: wasify_instance } = await WebAssembly.instantiate(wasijs_cached, {});
    const { memory, alloc, free, buffer, wasify } = wasify_instance.exports;

    const buf_p = buffer();
    alloc(buf_p, wasm.length);

    let view = new DataView(memory.buffer);
    const wi = view.getUint32(buf_p + 0, true);
    const wi_len = view.getUint32(buf_p + 4, true);
    new Uint8Array(memory.buffer, wi, wi_len).set(wasm);

    wasify(buf_p, wi, wi_len);

    view = new DataView(memory.buffer);
    const w = view.getUint32(buf_p + 0, true);
    const w_len = view.getUint32(buf_p + 4, true);
    const m = view.getUint32(buf_p + 8, true);
    const m_len = view.getUint32(buf_p + 12, true);

    const manifest = JSON.parse(Buffer.from(
        new Uint8Array(memory.buffer, m, m_len)
    ).toString());
    free(m, m_len);

    const wasi = initWasiObject(manifest);
    const wasm_output = new Uint8Array(memory.buffer, w, w_len);
    const { instance } = await WebAssembly.instantiate(wasm_output, wasi);
    free(w, w_len);

    return instance;
}

(async function() {
    const wasm_input = fs.readFileSync("test/hello.wasm");

    const instance = await instantiateWasi(wasm_input);
    instance.exports._start();
})().catch(console.error);
