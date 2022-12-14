// Copyright 2022 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef V8_COMMON_PTR_COMPR_H_
#define V8_COMMON_PTR_COMPR_H_

#include "src/base/memory.h"
#include "src/common/globals.h"

namespace v8::internal {

// This is just a collection of compression scheme related functions. Having
// such a class allows plugging different decompression scheme in certain
// places by introducing another CompressionScheme class with a customized
// implementation. This is useful, for example, for CodeDataContainer::code
// field (see CodeObjectSlot).
class V8HeapCompressionScheme {
 public:
  V8_INLINE static Address GetPtrComprCageBaseAddress(Address on_heap_addr);

  V8_INLINE static Address GetPtrComprCageBaseAddress(
      PtrComprCageBase cage_base);

  // Compresses full-pointer representation of a tagged value to on-heap
  // representation.
  V8_INLINE static Tagged_t CompressTagged(Address tagged);

  // Decompresses smi value.
  V8_INLINE static Address DecompressTaggedSigned(Tagged_t raw_value);

  // Decompresses weak or strong heap object pointer or forwarding pointer,
  // preserving both weak- and smi- tags.
  template <typename TOnHeapAddress>
  V8_INLINE static Address DecompressTaggedPointer(TOnHeapAddress on_heap_addr,
                                                   Tagged_t raw_value);
  // Decompresses any tagged value, preserving both weak- and smi- tags.
  template <typename TOnHeapAddress>
  V8_INLINE static Address DecompressTaggedAny(TOnHeapAddress on_heap_addr,
                                               Tagged_t raw_value);
};

#ifdef V8_EXTERNAL_CODE_SPACE
// Compression scheme used for fields containing Code objects (namely for the
// CodeDataContainer::code field).
using ExternalCodeCompressionScheme = V8HeapCompressionScheme;
#endif  // V8_EXTERNAL_CODE_SPACE

// Accessors for fields that may be unaligned due to pointer compression.

template <typename V>
static inline V ReadMaybeUnalignedValue(Address p) {
  // Pointer compression causes types larger than kTaggedSize to be unaligned.
#ifdef V8_COMPRESS_POINTERS
  constexpr bool v8_pointer_compression_unaligned = sizeof(V) > kTaggedSize;
#else
  constexpr bool v8_pointer_compression_unaligned = false;
#endif
  // Bug(v8:8875) Double fields may be unaligned.
  constexpr bool unaligned_double_field =
      std::is_same<V, double>::value && kDoubleSize > kTaggedSize;
  if (unaligned_double_field || v8_pointer_compression_unaligned) {
    return base::ReadUnalignedValue<V>(p);
  } else {
    return base::Memory<V>(p);
  }
}

template <typename V>
static inline void WriteMaybeUnalignedValue(Address p, V value) {
  // Pointer compression causes types larger than kTaggedSize to be unaligned.
#ifdef V8_COMPRESS_POINTERS
  constexpr bool v8_pointer_compression_unaligned = sizeof(V) > kTaggedSize;
#else
  constexpr bool v8_pointer_compression_unaligned = false;
#endif
  // Bug(v8:8875) Double fields may be unaligned.
  constexpr bool unaligned_double_field =
      std::is_same<V, double>::value && kDoubleSize > kTaggedSize;
  if (unaligned_double_field || v8_pointer_compression_unaligned) {
    base::WriteUnalignedValue<V>(p, value);
  } else {
    base::Memory<V>(p) = value;
  }
}

}  // namespace v8::internal

#endif  // V8_COMMON_PTR_COMPR_H_
