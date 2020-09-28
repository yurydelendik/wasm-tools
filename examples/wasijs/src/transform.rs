use serde::Serialize;
use wasmemit::*;

#[derive(Serialize)]
pub struct MemoryManifest {
    pub initial: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub maximum: Option<u32>,
    pub shared: bool,
}

#[derive(Serialize)]
pub struct Manifest {
    pub memory: MemoryManifest,
}

pub fn transform(data: &[u8]) -> (Vec<u8>, Manifest) {
    let mut module = read(data).expect("wasm data");
    let mut memory = None;

    match module {
        Module {
            kind: ModuleKind::Text(ref mut fields),
            ..
        } => {
            let after_imports = fields
                .iter()
                .enumerate()
                .rev()
                .find(|(_, f)| {
                    if let ModuleField::Import(_) = f {
                        true
                    } else {
                        false
                    }
                })
                .map_or(0, |(i, _)| i + 1);
            let (i, f) = fields
                .iter_mut()
                .enumerate()
                .find(|(_, f)| {
                    if let ModuleField::Memory(_) = f {
                        true
                    } else {
                        false
                    }
                })
                .expect("memory found");

            // replace memory to be import
            if let ModuleField::Memory(mem) = f {
                match mem.kind {
                    MemoryKind::Normal(ty) => {
                        let import = InlineImport {
                            module: "wasi_js",
                            field: Some("memory"),
                        };
                        if let MemoryType::B32 { ref limits, shared } = ty {
                            memory = Some(MemoryManifest {
                                initial: limits.min,
                                maximum: limits.max,
                                shared,
                            });
                        }
                        mem.kind = MemoryKind::Import { ty, import };
                    }
                    _ => panic!("unexpected mem kind"),
                }
            }

            // also move it before non-import
            let m = fields.remove(i);
            fields.insert(after_imports, m);
        }
        _ => panic!("expected text"),
    }

    (
        module.encode().expect("write wasm"),
        Manifest {
            memory: memory.expect("memory def"),
        },
    )
}
