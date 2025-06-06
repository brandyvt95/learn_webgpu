import { EPSILON } from './common.js';
const IDENTITY_2X3 = new Float32Array([
    1, 0,
    0, 1,
    0, 0,
]);
/**
 * A 2x3 Matrix
 */
export class Mat2d extends Float32Array {
    /**
     * The number of bytes in a {@link Mat2d}.
     */
    static BYTE_LENGTH = 6 * Float32Array.BYTES_PER_ELEMENT;
    /**
     * Create a {@link Mat2}.
     */
    constructor(...values) {
        switch (values.length) {
            case 6:
                super(values);
                break;
            case 2:
                super(values[0], values[1], 6);
                break;
            case 1:
                const v = values[0];
                if (typeof v === 'number') {
                    super([
                        v, v,
                        v, v,
                        v, v
                    ]);
                }
                else {
                    super(v, 0, 6);
                }
                break;
            default:
                super(IDENTITY_2X3);
                break;
        }
    }
    //============
    // Attributes
    //============
    /**
     * A string representation of `this`
     * Equivalent to `Mat2d.str(this);`
     */
    get str() {
        return Mat2d.str(this);
    }
    //===================
    // Instances methods
    //===================
    /**
     * Copy the values from another {@link Mat2d} into `this`.
     *
     * @param a the source vector
     * @returns `this`
     */
    copy(a) {
        this.set(a);
        return this;
    }
    /**
     * Set `this` to the identity matrix
     * Equivalent to Mat2d.identity(this)
     *
     * @returns `this`
     */
    identity() {
        this.set(IDENTITY_2X3);
        return this;
    }
    /**
     * Multiplies this {@link Mat2d} against another one
     * Equivalent to `Mat2d.multiply(this, this, b);`
     *
     * @param out - The receiving Matrix
     * @param a - The first operand
     * @param b - The second operand
     * @returns `this`
     */
    multiply(b) {
        return Mat2d.multiply(this, this, b);
    }
    /**
     * Alias for {@link Mat2d.multiply}
     */
    mul(b) { return this; }
    /**
     * Translate this {@link Mat2d} by the given vector
     * Equivalent to `Mat2d.translate(this, this, v);`
     *
     * @param v - The {@link Vec2} to translate by
     * @returns `this`
     */
    translate(v) {
        return Mat2d.translate(this, this, v);
    }
    /**
     * Rotates this {@link Mat2d} by the given angle around the given axis
     * Equivalent to `Mat2d.rotate(this, this, rad);`
     *
     * @param rad - the angle to rotate the matrix by
     * @returns `out`
     */
    rotate(rad) {
        return Mat2d.rotate(this, this, rad);
    }
    /**
     * Scales this {@link Mat2d} by the dimensions in the given vec3 not using vectorization
     * Equivalent to `Mat2d.scale(this, this, v);`
     *
     * @param v - The {@link Vec2} to scale the matrix by
     * @returns `this`
     */
    scale(v) {
        return Mat2d.scale(this, this, v);
    }
    //================
    // Static methods
    //================
    /**
     * Creates a new, identity {@link Mat2d}
     * @category Static
     *
     * @returns A new {@link Mat2d}
     */
    static create() {
        return new Mat2d();
    }
    /**
     * Creates a new {@link Mat2d} initialized with values from an existing matrix
     * @category Static
     *
     * @param a - Matrix to clone
     * @returns A new {@link Mat2d}
     */
    static clone(a) {
        return new Mat2d(a);
    }
    /**
     * Copy the values from one {@link Mat2d} to another
     * @category Static
     *
     * @param out - The receiving Matrix
     * @param a - Matrix to copy
     * @returns `out`
     */
    static copy(out, a) {
        out[0] = a[0];
        out[1] = a[1];
        out[2] = a[2];
        out[3] = a[3];
        out[4] = a[4];
        out[5] = a[5];
        return out;
    }
    /**
     * Create a new {@link Mat2d} with the given values
     * @category Static
     *
     * @param values - Matrix components
     * @returns A new {@link Mat2d}
     */
    static fromValues(...values) {
        return new Mat2d(...values);
    }
    /**
     * Set the components of a {@link Mat2d} to the given values
     * @category Static
     *
     * @param out - The receiving matrix
     * @param values - Matrix components
     * @returns `out`
     */
    static set(out, ...values) {
        out[0] = values[0];
        out[1] = values[1];
        out[2] = values[2];
        out[3] = values[3];
        out[4] = values[4];
        out[5] = values[5];
        return out;
    }
    /**
     * Set a {@link Mat2d} to the identity matrix
     * @category Static
     *
     * @param out - The receiving matrix
     * @returns `out`
     */
    static identity(out) {
        out[0] = 1;
        out[1] = 0;
        out[2] = 0;
        out[3] = 1;
        out[4] = 0;
        out[5] = 0;
        return out;
    }
    /**
     * Inverts a {@link Mat2d}
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the source matrix
     * @returns `out`
     */
    static invert(out, a) {
        const aa = a[0];
        const ab = a[1];
        const ac = a[2];
        const ad = a[3];
        const atx = a[4];
        const aty = a[5];
        let det = aa * ad - ab * ac;
        if (!det) {
            return null;
        }
        det = 1.0 / det;
        out[0] = ad * det;
        out[1] = -ab * det;
        out[2] = -ac * det;
        out[3] = aa * det;
        out[4] = (ac * aty - ad * atx) * det;
        out[5] = (ab * atx - aa * aty) * det;
        return out;
    }
    /**
     * Calculates the determinant of a {@link Mat2d}
     * @category Static
     *
     * @param a - the source matrix
     * @returns determinant of a
     */
    static determinant(a) {
        return a[0] * a[3] - a[1] * a[2];
    }
    /**
     * Adds two {@link Mat2d}'s
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the first operand
     * @param b - the second operand
     * @returns `out`
     */
    static add(out, a, b) {
        out[0] = a[0] + b[0];
        out[1] = a[1] + b[1];
        out[2] = a[2] + b[2];
        out[3] = a[3] + b[3];
        out[4] = a[4] + b[4];
        out[5] = a[5] + b[5];
        return out;
    }
    /**
     * Subtracts matrix b from matrix a
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the first operand
     * @param b - the second operand
     * @returns `out`
     */
    static subtract(out, a, b) {
        out[0] = a[0] - b[0];
        out[1] = a[1] - b[1];
        out[2] = a[2] - b[2];
        out[3] = a[3] - b[3];
        out[4] = a[4] - b[4];
        out[5] = a[5] - b[5];
        return out;
    }
    /**
     * Alias for {@link Mat2d.subtract}
     * @category Static
     */
    static sub(out, a, b) { return out; }
    /**
     * Multiplies two {@link Mat2d}s
     * @category Static
     *
     * @param out - The receiving Matrix
     * @param a - The first operand
     * @param b - The second operand
     * @returns `out`
     */
    static multiply(out, a, b) {
        const a0 = a[0];
        const a1 = a[1];
        const a2 = a[2];
        const a3 = a[3];
        const a4 = a[4];
        const a5 = a[5];
        const b0 = b[0];
        const b1 = b[1];
        const b2 = b[2];
        const b3 = b[3];
        const b4 = b[4];
        const b5 = b[5];
        out[0] = a0 * b0 + a2 * b1;
        out[1] = a1 * b0 + a3 * b1;
        out[2] = a0 * b2 + a2 * b3;
        out[3] = a1 * b2 + a3 * b3;
        out[4] = a0 * b4 + a2 * b5 + a4;
        out[5] = a1 * b4 + a3 * b5 + a5;
        return out;
    }
    /**
     * Alias for {@link Mat2d.multiply}
     * @category Static
     */
    static mul(out, a, b) { return out; }
    /**
     * Translate a {@link Mat2d} by the given vector
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the matrix to translate
     * @param v - vector to translate by
     * @returns `out`
     */
    static translate(out, a, v) {
        const a0 = a[0];
        const a1 = a[1];
        const a2 = a[2];
        const a3 = a[3];
        const a4 = a[4];
        const a5 = a[5];
        const v0 = v[0];
        const v1 = v[1];
        out[0] = a0;
        out[1] = a1;
        out[2] = a2;
        out[3] = a3;
        out[4] = a0 * v0 + a2 * v1 + a4;
        out[5] = a1 * v0 + a3 * v1 + a5;
        return out;
    }
    /**
     * Rotates a {@link Mat2d} by the given angle
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the matrix to rotate
     * @param rad - the angle to rotate the matrix by
     * @returns `out`
     */
    static rotate(out, a, rad) {
        const a0 = a[0];
        const a1 = a[1];
        const a2 = a[2];
        const a3 = a[3];
        const a4 = a[4];
        const a5 = a[5];
        const s = Math.sin(rad);
        const c = Math.cos(rad);
        out[0] = a0 * c + a2 * s;
        out[1] = a1 * c + a3 * s;
        out[2] = a0 * -s + a2 * c;
        out[3] = a1 * -s + a3 * c;
        out[4] = a4;
        out[5] = a5;
        return out;
    }
    /**
     * Scales the {@link Mat2d} by the dimensions in the given {@link Vec2}
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the matrix to scale
     * @param v - the {@link Vec2} to scale the matrix by
     * @returns `out`
     **/
    static scale(out, a, v) {
        const a0 = a[0];
        const a1 = a[1];
        const a2 = a[2];
        const a3 = a[3];
        const a4 = a[4];
        const a5 = a[5];
        const v0 = v[0];
        const v1 = v[1];
        out[0] = a0 * v0;
        out[1] = a1 * v0;
        out[2] = a2 * v1;
        out[3] = a3 * v1;
        out[4] = a4;
        out[5] = a5;
        return out;
    }
    // TODO: Got to fromRotation
    /**
     * Creates a {@link Mat2d} from a vector translation
     * This is equivalent to (but much faster than):
     *
     *     Mat2d.identity(dest);
     *     Mat2d.translate(dest, dest, vec);
     * @category Static
     *
     * @param out - {@link Mat2d} receiving operation result
     * @param v - Translation vector
     * @returns `out`
     */
    static fromTranslation(out, v) {
        out[0] = 1;
        out[1] = 0;
        out[2] = 0;
        out[3] = 1;
        out[4] = v[0];
        out[5] = v[1];
        return out;
    }
    /**
     * Creates a {@link Mat2d} from a given angle around a given axis
     * This is equivalent to (but much faster than):
     *
     *     Mat2d.identity(dest);
     *     Mat2d.rotate(dest, dest, rad);
     * @category Static
     *
     * @param out - {@link Mat2d} receiving operation result
     * @param rad - the angle to rotate the matrix by
     * @returns `out`
     */
    static fromRotation(out, rad) {
        const s = Math.sin(rad);
        const c = Math.cos(rad);
        out[0] = c;
        out[1] = s;
        out[2] = -s;
        out[3] = c;
        out[4] = 0;
        out[5] = 0;
        return out;
    }
    /**
     * Creates a {@link Mat2d} from a vector scaling
     * This is equivalent to (but much faster than):
     *
     *     Mat2d.identity(dest);
     *     Mat2d.scale(dest, dest, vec);
     * @category Static
     *
     * @param out - {@link Mat2d} receiving operation result
     * @param v - Scaling vector
     * @returns `out`
     */
    static fromScaling(out, v) {
        out[0] = v[0];
        out[1] = 0;
        out[2] = 0;
        out[3] = v[1];
        out[4] = 0;
        out[5] = 0;
        return out;
    }
    /**
     * Returns Frobenius norm of a {@link Mat2d}
     * @category Static
     *
     * @param a - the matrix to calculate Frobenius norm of
     * @returns Frobenius norm
     */
    static frob(a) {
        return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[3] * a[3] + a[4] * a[4] + a[5] * a[5] + 1);
    }
    /**
     * Multiply each element of a {@link Mat2d} by a scalar.
     * @category Static
     *
     * @param out - the receiving matrix
     * @param a - the matrix to scale
     * @param b - amount to scale the matrix's elements by
     * @returns `out`
     */
    static multiplyScalar(out, a, b) {
        out[0] = a[0] * b;
        out[1] = a[1] * b;
        out[2] = a[2] * b;
        out[3] = a[3] * b;
        out[4] = a[4] * b;
        out[5] = a[5] * b;
        return out;
    }
    /**
     * Adds two {@link Mat2d}'s after multiplying each element of the second operand by a scalar value.
     * @category Static
     *
     * @param out - the receiving vector
     * @param a - the first operand
     * @param b - the second operand
     * @param scale - the amount to scale b's elements by before adding
     * @returns `out`
     */
    static multiplyScalarAndAdd(out, a, b, scale) {
        out[0] = a[0] + b[0] * scale;
        out[1] = a[1] + b[1] * scale;
        out[2] = a[2] + b[2] * scale;
        out[3] = a[3] + b[3] * scale;
        out[4] = a[4] + b[4] * scale;
        out[5] = a[5] + b[5] * scale;
        return out;
    }
    /**
     * Returns whether or not two {@link Mat2d}s have exactly the same elements in the same position (when compared with ===)
     * @category Static
     *
     * @param a - The first matrix.
     * @param b - The second matrix.
     * @returns True if the matrices are equal, false otherwise.
     */
    static exactEquals(a, b) {
        return (a[0] === b[0] &&
            a[1] === b[1] &&
            a[2] === b[2] &&
            a[3] === b[3] &&
            a[4] === b[4] &&
            a[5] === b[5]);
    }
    /**
     * Returns whether or not two {@link Mat2d}s have approximately the same elements in the same position.
     * @category Static
     *
     * @param a - The first matrix.
     * @param b - The second matrix.
     * @returns True if the matrices are equal, false otherwise.
     */
    static equals(a, b) {
        const a0 = a[0];
        const a1 = a[1];
        const a2 = a[2];
        const a3 = a[3];
        const a4 = a[4];
        const a5 = a[5];
        const b0 = b[0];
        const b1 = b[1];
        const b2 = b[2];
        const b3 = b[3];
        const b4 = b[4];
        const b5 = b[5];
        return (Math.abs(a0 - b0) <= EPSILON * Math.max(1, Math.abs(a0), Math.abs(b0)) &&
            Math.abs(a1 - b1) <= EPSILON * Math.max(1, Math.abs(a1), Math.abs(b1)) &&
            Math.abs(a2 - b2) <= EPSILON * Math.max(1, Math.abs(a2), Math.abs(b2)) &&
            Math.abs(a3 - b3) <= EPSILON * Math.max(1, Math.abs(a3), Math.abs(b3)) &&
            Math.abs(a4 - b4) <= EPSILON * Math.max(1, Math.abs(a4), Math.abs(b4)) &&
            Math.abs(a5 - b5) <= EPSILON * Math.max(1, Math.abs(a5), Math.abs(b5)));
    }
    /**
     * Returns a string representation of a {@link Mat2d}
     * @category Static
     *
     * @param a - matrix to represent as a string
     * @returns string representation of the matrix
     */
    static str(a) {
        return `Mat2d(${a.join(', ')})`;
    }
}
// Static method alias assignments
Mat2d.mul = Mat2d.multiply;
Mat2d.sub = Mat2d.subtract;
/**
 * {@link Mat2d} alias for backwards compatibility
 */
export const mat2d = Mat2d;
//# sourceMappingURL=mat2d.js.map