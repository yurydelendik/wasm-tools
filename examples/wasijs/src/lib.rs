use std::mem::MaybeUninit;

mod transform;

static mut BUF: [MaybeUninit<u8>; 128] = [MaybeUninit::uninit(); 128];

#[no_mangle]
pub extern "C" fn alloc(len: usize) -> Box<[MaybeUninit<u8>]> {
    vec![MaybeUninit::uninit(); len].into_boxed_slice()
}

#[no_mangle]
pub extern "C" fn free(_p: Box<[MaybeUninit<u8>]>) {}

#[no_mangle]
pub unsafe extern "C" fn buffer() -> *mut MaybeUninit<u8> {
    BUF.as_mut_ptr()
}

#[no_mangle]
pub extern "C" fn wasify(data: Box<[u8]>) -> (Box<[u8]>, Box<[u8]>) {
    let (wasm, manifest) = transform::transform(&data);
    (
        wasm.into_boxed_slice(),
        serde_json::to_vec(&manifest).unwrap().into_boxed_slice(),
    )
}
