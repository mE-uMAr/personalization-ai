import os

# One thread for numpy's BLAS: the matrices are tiny, and on a fractional-CPU host extra threads only contend.
for _v in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ.setdefault(_v, "1")
