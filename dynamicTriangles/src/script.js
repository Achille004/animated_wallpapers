var Delaunay;

(function () {
    "use strict";

    var EPSILON = 1.0 / 1048576.0;

    function supertriangle(vertices) {
        var xmin = Number.POSITIVE_INFINITY,
            ymin = Number.POSITIVE_INFINITY,
            xmax = Number.NEGATIVE_INFINITY,
            ymax = Number.NEGATIVE_INFINITY,
            i, dx, dy, dmax, xmid, ymid;

        for (i = vertices.length; i--;) {
            if (vertices[i][0] < xmin) xmin = vertices[i][0];
            if (vertices[i][0] > xmax) xmax = vertices[i][0];
            if (vertices[i][1] < ymin) ymin = vertices[i][1];
            if (vertices[i][1] > ymax) ymax = vertices[i][1];
        }

        dx = xmax - xmin;
        dy = ymax - ymin;
        dmax = Math.max(dx, dy);
        xmid = xmin + dx * 0.5;
        ymid = ymin + dy * 0.5;

        return [
            [xmid - 20 * dmax, ymid - dmax],
            [xmid, ymid + 20 * dmax],
            [xmid + 20 * dmax, ymid - dmax]
        ];
    }

    function circumcircle(vertices, i, j, k) {
        var x1 = vertices[i][0],
            y1 = vertices[i][1],
            x2 = vertices[j][0],
            y2 = vertices[j][1],
            x3 = vertices[k][0],
            y3 = vertices[k][1],
            fabsy1y2 = Math.abs(y1 - y2),
            fabsy2y3 = Math.abs(y2 - y3),
            xc, yc, m1, m2, mx1, mx2, my1, my2, dx, dy;

        /* Check for coincident points */
        if (fabsy1y2 < EPSILON && fabsy2y3 < EPSILON)
            throw new Error("Eek! Coincident points!");

        if (fabsy1y2 < EPSILON) {
            m2 = -((x3 - x2) / (y3 - y2));
            mx2 = (x2 + x3) / 2.0;
            my2 = (y2 + y3) / 2.0;
            xc = (x2 + x1) / 2.0;
            yc = m2 * (xc - mx2) + my2;
        } else if (fabsy2y3 < EPSILON) {
            m1 = -((x2 - x1) / (y2 - y1));
            mx1 = (x1 + x2) / 2.0;
            my1 = (y1 + y2) / 2.0;
            xc = (x3 + x2) / 2.0;
            yc = m1 * (xc - mx1) + my1;
        } else {
            m1 = -((x2 - x1) / (y2 - y1));
            m2 = -((x3 - x2) / (y3 - y2));
            mx1 = (x1 + x2) / 2.0;
            mx2 = (x2 + x3) / 2.0;
            my1 = (y1 + y2) / 2.0;
            my2 = (y2 + y3) / 2.0;
            xc = (m1 * mx1 - m2 * mx2 + my2 - my1) / (m1 - m2);
            yc = (fabsy1y2 > fabsy2y3) ?
                m1 * (xc - mx1) + my1 :
                m2 * (xc - mx2) + my2;
        }

        dx = x2 - xc;
        dy = y2 - yc;
        return {
            i: i,
            j: j,
            k: k,
            x: xc,
            y: yc,
            r: dx * dx + dy * dy
        };
    }

    function dedup(edges) {
        var i, j, a, b, m, n;

        for (j = edges.length; j;) {
            b = edges[--j];
            a = edges[--j];

            for (i = j; i;) {
                n = edges[--i];
                m = edges[--i];

                if ((a === m && b === n) || (a === n && b === m)) {
                    edges.splice(j, 2);
                    edges.splice(i, 2);
                    break;
                }
            }
        }
    }

    Delaunay = {
        triangulate: function (vertices, key) {
            var n = vertices.length,
                i, j, indices, st, open, closed, edges, dx, dy, a, b, c;

            /* Bail if there aren't enough vertices to form any triangles. */
            if (n < 3)
                return [];

            /* Slice out the actual vertices from the passed objects. (Duplicate the
             * array even if we don't, though, since we need to make a supertriangle
             * later on!) */
            vertices = vertices.slice(0);

            if (key)
                for (i = n; i--;)
                    vertices[i] = vertices[i][key];

            /* Make an array of indices into the vertex array, sorted by the
             * vertices' x-position. */
            indices = new Array(n);

            for (i = n; i--;)
                indices[i] = i;

            indices.sort(function (i, j) {
                return vertices[j][0] - vertices[i][0];
            });

            /* Next, find the vertices of the supertriangle (which contains all other
             * triangles), and append them onto the end of a (copy of) the vertex
             * array. */
            st = supertriangle(vertices);
            vertices.push(st[0], st[1], st[2]);

            /* Initialize the open list (containing the supertriangle and nothing
             * else) and the closed list (which is empty since we havn't processed
             * any triangles yet). */
            open = [circumcircle(vertices, n + 0, n + 1, n + 2)];
            closed = [];
            edges = [];

            /* Incrementally add each vertex to the mesh. */
            for (i = indices.length; i--; edges.length = 0) {
                c = indices[i];

                /* For each open triangle, check to see if the current point is
                 * inside it's circumcircle. If it is, remove the triangle and add
                 * it's edges to an edge list. */
                for (j = open.length; j--;) {
                    /* If this point is to the right of this triangle's circumcircle,
                     * then this triangle should never get checked again. Remove it
                     * from the open list, add it to the closed list, and skip. */
                    dx = vertices[c][0] - open[j].x;
                    if (dx > 0.0 && dx * dx > open[j].r) {
                        closed.push(open[j]);
                        open.splice(j, 1);
                        continue;
                    }

                    /* If we're outside the circumcircle, skip this triangle. */
                    dy = vertices[c][1] - open[j].y;
                    if (dx * dx + dy * dy - open[j].r > EPSILON)
                        continue;

                    /* Remove the triangle and add it's edges to the edge list. */
                    edges.push(
                        open[j].i, open[j].j,
                        open[j].j, open[j].k,
                        open[j].k, open[j].i
                    );
                    open.splice(j, 1);
                }

                /* Remove any doubled edges. */
                dedup(edges);

                /* Add a new triangle for each edge. */
                for (j = edges.length; j;) {
                    b = edges[--j];
                    a = edges[--j];
                    open.push(circumcircle(vertices, a, b, c));
                }
            }

            /* Copy any remaining open triangles to the closed list, and then
             * remove any triangles that share a vertex with the supertriangle,
             * building a list of triplets that represent triangles. */
            for (i = open.length; i--;)
                closed.push(open[i]);
            open.length = 0;

            for (i = closed.length; i--;)
                if (closed[i].i < n && closed[i].j < n && closed[i].k < n)
                    open.push(closed[i].i, closed[i].j, closed[i].k);

            /* Yay, we're done! */
            return open;
        },
        contains: function (tri, p) {
            /* Bounding box test first, for quick rejections. */
            if ((p[0] < tri[0][0] && p[0] < tri[1][0] && p[0] < tri[2][0]) ||
                (p[0] > tri[0][0] && p[0] > tri[1][0] && p[0] > tri[2][0]) ||
                (p[1] < tri[0][1] && p[1] < tri[1][1] && p[1] < tri[2][1]) ||
                (p[1] > tri[0][1] && p[1] > tri[1][1] && p[1] > tri[2][1]))
                return null;

            var a = tri[1][0] - tri[0][0],
                b = tri[2][0] - tri[0][0],
                c = tri[1][1] - tri[0][1],
                d = tri[2][1] - tri[0][1],
                i = a * d - b * c;

            /* Degenerate tri. */
            if (i === 0.0)
                return null;

            var u = (d * (p[0] - tri[0][0]) - b * (p[1] - tri[0][1])) / i,
                v = (a * (p[1] - tri[0][1]) - c * (p[0] - tri[0][0])) / i;

            /* If we're outside the tri, fail. */
            if (u < 0.0 || v < 0.0 || (u + v) > 1.0)
                return null;

            return [u, v];
        }
    };

    if (typeof module !== "undefined")
        module.exports = Delaunay;
})();

/**
 * @object Math Augmentation
 * @author Matthew Wagerfield
 */
Math.PIM2 = Math.PI * 2;
Math.PID2 = Math.PI / 2;
Math.randomInRange = function (min, max) {
    return min + (max - min) * Math.random();
};
Math.clamp = function (value, min, max) {
    value = Math.max(value, min);
    value = Math.min(value, max);
    return value;
};

/**
 * Request Animation Frame Polyfill.
 * @author Paul Irish
 * @see https://gist.github.com/paulirish/1579671
 */
(function () {
    var lastTime = 0;
    var vendors = ['ms', 'moz', 'webkit', 'o'];

    for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x] + 'CancelAnimationFrame'] || window[vendors[x] + 'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = function (callback, element) {
            var currentTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currentTime - lastTime));
            var id = window.setTimeout(function () {
                callback(currentTime + timeToCall);
            }, timeToCall);
            lastTime = currentTime + timeToCall;
            return id;
        };
    }

    if (!window.cancelAnimationFrame) {
        window.cancelAnimationFrame = function (id) {
            clearTimeout(id);
        };
    }
}());

// #region FSS
/**
 * Defines the Flat Surface Shader namespace for all the awesomeness to exist upon.
 * @author Matthew Wagerfield
 */
FSS = {
    FRONT: 0,
    BACK: 1,
    DOUBLE: 2,
    SVGNS: 'http://www.w3.org/2000/svg'
}

/**
 * @class Array
 * @author Matthew Wagerfield
 */
class FSSArray extends(typeof Float32Array === 'function' ? Float32Array : Array) {
    constructor() {}
}

/**
 * @class Utils
 * @author Matthew Wagerfield
 */
class Utils {
    static isNumber(value) {
        return !isNaN(parseFloat(value)) && isFinite(value)
    }
}

/**
 * @object Vector3
 * @author Matthew Wagerfield
 */
class Vector3 {
    static create(x, y, z) {
        var vector = new Array(3)
        this.set(vector, x, y, z)
        return vector
    }

    static clone(a) {
        var vector = this.create()
        this.copy(vector, a)
        return vector
    }

    static set(target, x, y, z) {
        target[0] = x || 0
        target[1] = y || 0
        target[2] = z || 0
        return this
    }

    static setX(target, x) {
        target[0] = x || 0
        return this
    }

    static setY(target, y) {
        target[1] = y || 0
        return this
    }

    static setZ(target, z) {
        target[2] = z || 0
        return this
    }

    static copy(target, a) {
        target[0] = a[0]
        target[1] = a[1]
        target[2] = a[2]
        return this
    }

    static add(target, a) {
        target[0] += a[0]
        target[1] += a[1]
        target[2] += a[2]
        return this
    }

    static addVectors(target, a, b) {
        target[0] = a[0] + b[0]
        target[1] = a[1] + b[1]
        target[2] = a[2] + b[2]
        return this
    }

    static addScalar(target, s) {
        target[0] += s
        target[1] += s
        target[2] += s
        return this
    }

    static subtract(target, a) {
        target[0] -= a[0]
        target[1] -= a[1]
        target[2] -= a[2]
        return this
    }

    static subtractVectors(target, a, b) {
        target[0] = a[0] - b[0]
        target[1] = a[1] - b[1]
        target[2] = a[2] - b[2]
        return this
    }

    static subtractScalar(target, s) {
        target[0] -= s
        target[1] -= s
        target[2] -= s
        return this
    }

    static multiply(target, a) {
        target[0] *= a[0]
        target[1] *= a[1]
        target[2] *= a[2]
        return this
    }

    static multiplyVectors(target, a, b) {
        target[0] = a[0] * b[0]
        target[1] = a[1] * b[1]
        target[2] = a[2] * b[2]
        return this
    }

    static multiplyScalar(target, s) {
        target[0] *= s
        target[1] *= s
        target[2] *= s
        return this
    }

    static divide(target, a) {
        target[0] /= a[0]
        target[1] /= a[1]
        target[2] /= a[2]
        return this
    }

    static divideVectors(target, a, b) {
        target[0] = a[0] / b[0]
        target[1] = a[1] / b[1]
        target[2] = a[2] / b[2]
        return this
    }

    static divideScalar(target, s) {
        if (s !== 0) {
            target[0] /= s
            target[1] /= s
            target[2] /= s
        } else {
            target[0] = 0
            target[1] = 0
            target[2] = 0
        }
        return this
    }

    static cross(target, a) {
        var x = target[0]
        var y = target[1]
        var z = target[2]
        target[0] = y * a[2] - z * a[1]
        target[1] = z * a[0] - x * a[2]
        target[2] = x * a[1] - y * a[0]
        return this
    }

    static crossVectors(target, a, b) {
        target[0] = a[1] * b[2] - a[2] * b[1]
        target[1] = a[2] * b[0] - a[0] * b[2]
        target[2] = a[0] * b[1] - a[1] * b[0]
        return this
    }

    static min(target, value) {
        if (target[0] < value) {
            target[0] = value
        }
        if (target[1] < value) {
            target[1] = value
        }
        if (target[2] < value) {
            target[2] = value
        }
        return this
    }

    static max(target, value) {
        if (target[0] > value) {
            target[0] = value
        }
        if (target[1] > value) {
            target[1] = value
        }
        if (target[2] > value) {
            target[2] = value
        }
        return this
    }

    static clamp(target, min, max) {
        this.min(target, min)
        this.max(target, max)
        return this
    }

    static limit(target, min, max) {
        var length = this.length(target)
        if (min !== null && length < min) {
            this.setLength(target, min)
        } else if (max !== null && length > max) {
            this.setLength(target, max)
        }
        return this
    }

    static dot(a, b) {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
    }

    static normalise(target) {
        return this.divideScalar(target, this.length(target))
    }

    static negate(target) {
        return this.multiplyScalar(target, -1)
    }

    static distanceSquared(a, b) {
        var dx = a[0] - b[0]
        var dy = a[1] - b[1]
        var dz = a[2] - b[2]
        return dx * dx + dy * dy + dz * dz
    }

    static distance(a, b) {
        return Math.sqrt(this.distanceSquared(a, b))
    }

    static lengthSquared(a) {
        return a[0] * a[0] + a[1] * a[1] + a[2] * a[2]
    }

    static length(a) {
        return Math.sqrt(this.lengthSquared(a))
    }

    static setLength(target, l) {
        var length = this.length(target)
        if (length !== 0 && l !== length) {
            this.multiplyScalar(target, l / length)
        }
        return this
    }
}

/**
 * @object Vector4
 * @author Matthew Wagerfield
 */
class Vector4 {
    static create(x, y, z, w) {
        var vector = new Array(4)
        this.set(vector, x, y, z)
        return vector
    }

    static set(target, x, y, z, w) {
        target[0] = x || 0
        target[1] = y || 0
        target[2] = z || 0
        target[3] = w || 0
        return this
    }

    static setX(target, x) {
        target[0] = x || 0
        return this
    }

    static setY(target, y) {
        target[1] = y || 0
        return this
    }

    static setZ(target, z) {
        target[2] = z || 0
        return this
    }

    static setW(target, w) {
        target[3] = w || 0
        return this
    }

    static add(target, a) {
        target[0] += a[0]
        target[1] += a[1]
        target[2] += a[2]
        target[3] += a[3]
        return this
    }

    static multiplyVectors(target, a, b) {
        target[0] = a[0] * b[0]
        target[1] = a[1] * b[1]
        target[2] = a[2] * b[2]
        target[3] = a[3] * b[3]
        return this
    }

    static multiplyScalar(target, s) {
        target[0] *= s
        target[1] *= s
        target[2] *= s
        target[3] *= s
        return this
    }

    static min(target, value) {
        if (target[0] < value) {
            target[0] = value
        }
        if (target[1] < value) {
            target[1] = value
        }
        if (target[2] < value) {
            target[2] = value
        }
        if (target[3] < value) {
            target[3] = value
        }
        return this
    }

    static max(target, value) {
        if (target[0] > value) {
            target[0] = value
        }
        if (target[1] > value) {
            target[1] = value
        }
        if (target[2] > value) {
            target[2] = value
        }
        if (target[3] > value) {
            target[3] = value
        }
        return this
    }

    static clamp(target, min, max) {
        this.min(target, min)
        this.max(target, max)
        return this
    }
}

/**
 * @class Color
 * @author Matthew Wagerfield
 */
class Color {
    constructor(hex, opacity) {
        this.rgba = Vector4.create()
        this.hex = hex || '#000000'
        this.opacity = Utils.isNumber(opacity) ? opacity : 1
        this.set(this.hex, this.opacity)
    }

    set(hex, opacity) {
        hex = hex.replace('#', '')
        var size = hex.length / 3
        this.rgba[0] = parseInt(hex.substring(size * 0, size * 1), 16) / 255
        this.rgba[1] = parseInt(hex.substring(size * 1, size * 2), 16) / 255
        this.rgba[2] = parseInt(hex.substring(size * 2, size * 3), 16) / 255
        this.rgba[3] = Utils.isNumber(opacity) ? opacity : this.rgba[3]
        return this
    }

    hexify(channel) {
        var hex = Math.ceil(channel * 255).toString(16)
        if (hex.length === 1) {
            hex = '0' + hex
        }
        return hex
    }

    format() {
        var r = this.hexify(this.rgba[0])
        var g = this.hexify(this.rgba[1])
        var b = this.hexify(this.rgba[2])
        this.hex = '#' + r + g + b
        return this.hex
    }
}

/**
 * @class FSSObject
 * @author Matthew Wagerfield
 */
class FSSObject {
    constructor() {
        this.position = Vector3.create()
    }

    setPosition(x, y, z) {
        Vector3.set(this.position, x, y, z)
        return this
    }
}

/**
 * @class Light
 * @author Matthew Wagerfield
 */
class Light extends FSSObject {
    constructor(ambient, diffuse) {
        super()

        this.ambient = new Color(ambient || '#FFFFFF')
        this.diffuse = new Color(diffuse || '#FFFFFF')
        this.ray = Vector3.create()
    }
}

/**
 * @class Vertex
 * @author Matthew Wagerfield
 */
class Vertex {
    constructor(x, y, z) {
        this.position = Vector3.create(x, y, z)
    }

    setPosition(x, y, z) {
        Vector3.set(this.position, x, y, z)
        return this
    }
}

/**
 * @class Triangle
 * @author Matthew Wagerfield
 */
class Triangle {
    constructor(a, b, c) {
        this.a = a || new Vertex()
        this.b = b || new Vertex()
        this.c = c || new Vertex()
        this.vertices = [this.a, this.b, this.c]
        this.u = Vector3.create()
        this.v = Vector3.create()
        this.centroid = Vector3.create()
        this.normal = Vector3.create()
        this.color = new Color()
        this.lineColor = new Color(MESH.borderColor, MESH.borderOpacity)
        this.polygon = document.createElementNS(FSS.SVGNS, 'polygon')
        this.polygon.setAttributeNS(null, 'stroke-linejoin', 'round')
        this.polygon.setAttributeNS(null, 'stroke-miterlimit', '1')
        this.polygon.setAttributeNS(null, 'stroke-width', '1')
        this.computeCentroid()
        this.computeNormal()
    }

    computeCentroid() {
        this.centroid[0] = this.a.position[0] + this.b.position[0] + this.c.position[0]
        this.centroid[1] = this.a.position[1] + this.b.position[1] + this.c.position[1]
        this.centroid[2] = this.a.position[2] + this.b.position[2] + this.c.position[2]
        Vector3.divideScalar(this.centroid, 3)
        return this
    }

    computeNormal() {
        Vector3.subtractVectors(this.u, this.b.position, this.a.position)
        Vector3.subtractVectors(this.v, this.c.position, this.a.position)
        Vector3.crossVectors(this.normal, this.u, this.v)
        Vector3.normalise(this.normal)
        return this
    }
}

/**
 * @class Geometry
 * @author Matthew Wagerfield
 */
class Geometry {
    constructor() {
        this.vertices = []
        this.triangles = []
        this.dirty = false
    }

    update() {
        if (this.dirty) {
            var t, triangle
            for (t = this.triangles.length - 1; t >= 0; t--) {
                triangle = this.triangles[t]
                triangle.computeCentroid()
                triangle.computeNormal()
            }
            this.dirty = false
        }
        return this
    }
}

/**
 * @class Plane
 * @author Matthew Wagerfield, modified by Maksim Surguy to implement Delaunay triangulation
 */
class Plane extends Geometry {
    constructor(width, height, howmany) {
        super()

        this.vertices = new Array(howmany)

        // Cache Variables
        var x, y
        var offsetX = width * -0.5,
            offsetY = height * 0.5

        for (i = 0; i < this.vertices.length; i++) {
            x = offsetX + Math.random() * width
            y = offsetY - Math.random() * height

            this.vertices[i] = [x, y, -1]
        }

        // Generate additional points on the perimeter so that there are no holes in the pattern
        this.vertices.push([offsetX, offsetY])
        this.vertices.push([offsetX + width / 2, offsetY])
        this.vertices.push([offsetX + width, offsetY])
        this.vertices.push([offsetX + width, offsetY - height / 2])
        this.vertices.push([offsetX + width, offsetY - height])
        this.vertices.push([offsetX + width / 2, offsetY - height])
        this.vertices.push([offsetX, offsetY - height])
        this.vertices.push([offsetX, offsetY - height / 2])

        // Generate additional randomly placed points on the perimeter
        for (var i = 0; i < 7; i++) {
            this.vertices.push([offsetX + Math.random() * width, offsetY])
            this.vertices.push([offsetX, offsetY - Math.random() * height])
            this.vertices.push([offsetX + width, offsetY - Math.random() * height])
            this.vertices.push([offsetX + Math.random() * width, offsetY - height])
        }

        this.vertices.push([0, 0])

        // Create an array of triangulated coordinates from our vertices
        this.generateTriangles(width / 2, height / 2, howmany)
    }

    // Update function to move vertices
    movementFrame(halfWidth, halfHeight, howmany) {
        for (var i = 0; i < howmany; i++) {
            var vertex = this.vertices[i]

            // If movement frame is -1 or over the RENDER.movementFrames
            if (vertex[2] == -1 || vertex[2] > RENDER.movementFrames) {
                var f = RENDER.movementFrames - 1
                var d = RENDER.movementDistance
                var r = RENDER.movementRandomness
                var dr = d * r,
                    fr = f * r

                // Modify x-coordinate variation randomly by +/- RENDER.movementDistance (with randomness)
                vertex[3] = Math.randomInRange(-Math.randomInRange(dr, d), Math.randomInRange(dr, d))
                if (Math.abs(vertex[0] + vertex[3]) > halfWidth) {
                    if (vertex[0] > 0) {
                        vertex[3] = halfWidth - vertex[0]
                    } else {
                        vertex[3] = -halfWidth - vertex[0]
                    }
                }

                // Modify y-coordinate variation randomly by +/- RENDER.movementDistance (with randomness)
                vertex[4] = Math.randomInRange(-Math.randomInRange(dr, d), Math.randomInRange(dr, d))
                if (Math.abs(vertex[1] + vertex[4]) > halfHeight) {
                    if (vertex[1] > 0) {
                        vertex[4] = halfHeight - vertex[1]
                    } else {
                        vertex[4] = -halfHeight - vertex[1]
                    }
                }

                // Choose the frames required for the animation (with randomness)
                vertex[5] = 1 + Math.randomInRange(fr, f)
                if (vertex[5] < 10) {
                    console.log(vertex[5])
                }

                vertex[2] = 0
            }

            // Modify the position by one frame
            vertex[0] += vertex[3] / vertex[5]
            vertex[1] += vertex[4] / vertex[5]

            vertex[2]++
        }

        if (MOUSE.x != undefined && MOUSE.y != undefined) {
            // 36 = (8 + 7*4) extra vertices on the borders
            this.vertices[howmany + 36] = [MOUSE.x - halfWidth, halfHeight - MOUSE.y]
        }

        this.generateTriangles(halfWidth, halfHeight, howmany)
    }

    // Generates the triangles based on the given vertices
    generateTriangles(halfWidth, halfHeight, howmany) {
        var triangleVertices = Delaunay.triangulate(this.vertices)
        this.triangles = []

        for (var i = triangleVertices.length; i;) {
            --i
            var p1 = [Math.ceil(this.vertices[triangleVertices[i]][0]), Math.ceil(this.vertices[triangleVertices[i]][1])]
                --i
            var p2 = [Math.ceil(this.vertices[triangleVertices[i]][0]), Math.ceil(this.vertices[triangleVertices[i]][1])]
                --i
            var p3 = [Math.ceil(this.vertices[triangleVertices[i]][0]), Math.ceil(this.vertices[triangleVertices[i]][1])]

            var t1 = new Triangle(new Vertex(p1[0], p1[1]), new Vertex(p2[0], p2[1]), new Vertex(p3[0], p3[1]))

            this.triangles.push(t1)
        }
    }
}

/**
 * @class Material
 * @author Matthew Wagerfield
 */
class Material {
    constructor(ambient, diffuse) {
        this.ambient = new Color(ambient || '#444444')
        this.diffuse = new Color(diffuse || '#FFFFFF')
        this.slave = new Color()
    }
}

/**
 * @class Mesh
 * @author Matthew Wagerfield
 */
class Mesh extends FSSObject {
    constructor(geometry, material) {
        super()

        this.geometry = geometry || new Geometry()
        this.material = material || new Material()
        this.side = FSS.FRONT
        this.visible = true
    }

    setGeometry(geometry) {
        this.geometry = geometry || new Geometry()
    }

    update(light, calculate) {
        var t, triangle, light, illuminance

        // Update Geometry
        this.geometry.update()

        // Calculate the triangle colors
        if (calculate) {
            // Iterate through Triangles
            for (t = this.geometry.triangles.length - 1; t >= 0; t--) {
                triangle = this.geometry.triangles[t]

                // Reset Triangle Color
                Vector4.set(triangle.color.rgba)

                // Calculate Illuminance
                Vector3.subtractVectors(light.ray, light.position, triangle.centroid)
                Vector3.setX(light.ray, 0) // Light extends trough screen width
                Vector3.normalise(light.ray)

                illuminance = Vector3.dot(triangle.normal, light.ray)
                if (this.side === FSS.FRONT) {
                    illuminance = Math.max(illuminance, 0)
                } else if (this.side === FSS.BACK) {
                    illuminance = Math.abs(Math.min(illuminance, 0))
                } else if (this.side === FSS.DOUBLE) {
                    illuminance = Math.max(Math.abs(illuminance), 0)
                }

                // Calculate Ambient Light
                Vector4.multiplyVectors(this.material.slave.rgba, this.material.ambient.rgba, light.ambient.rgba)
                Vector4.add(triangle.color.rgba, this.material.slave.rgba)

                // Calculate Diffuse Light
                Vector4.multiplyVectors(this.material.slave.rgba, this.material.diffuse.rgba, light.diffuse.rgba)
                Vector4.multiplyScalar(this.material.slave.rgba, illuminance)
                Vector4.add(triangle.color.rgba, this.material.slave.rgba)

                Vector4.multiplyScalar(triangle.lineColor.rgba, triangle.lineColor.opacity)
                Vector4.add(triangle.lineColor.rgba, this.material.slave.rgba)

                // Clamp & Format Color
                Vector4.clamp(triangle.color.rgba, 0, 1)
                Vector4.clamp(triangle.color.rgba, 0, 1)
            }
        }

        return this
    }
}

/**
 * @class Scene
 * @author Matthew Wagerfield
 */
class Scene {
    constructor() {
        this.meshes = []
        this.light = null
    }

    add(object) {
        if (object instanceof Mesh && !~this.meshes.indexOf(object)) {
            this.meshes.push(object)
        } else if (object instanceof Light) {
            this.light = object
        }
        return this
    }

    remove(object) {
        if (object instanceof Mesh && ~this.meshes.indexOf(object)) {
            this.meshes.splice(this.meshes.indexOf(object), 1)
        } else if (object instanceof Light) {
            this.light = null
        }
        return this
    }
}

/**
 * @class Renderer
 * @author Matthew Wagerfield
 */
class Renderer {
    constructor() {
        this.width = 0
        this.height = 0
        this.halfWidth = 0
        this.halfHeight = 0
    }

    setSize(width, height) {
        if (this.width === width && this.height === height) return
        this.width = width
        this.height = height
        this.halfWidth = this.width * 0.5
        this.halfHeight = this.height * 0.5
        return this
    }

    clear() {
        return this
    }

    render(scene) {
        return this
    }
}

/**
 * @class Canvas Renderer
 * @author Matthew Wagerfield
 */
class CanvasRenderer extends Renderer {
    constructor() {
        super()

        this.element = document.createElement('canvas')
        this.element.style.display = 'block'
        this.context = this.element.getContext('2d')
        this.setSize(this.element.width, this.element.height)
    }

    setSize(width, height) {
        Renderer.prototype.setSize.call(this, width, height)
        this.element.width = width
        this.element.height = height
        this.context.setTransform(1, 0, 0, -1, this.halfWidth, this.halfHeight)
        return this
    }

    clear() {
        super.clear()
        this.context.clearRect(-this.halfWidth, -this.halfHeight, this.width, this.height)
        return this
    }

    render(scene) {
        Renderer.prototype.render.call(this, scene)
        var m, mesh, t, triangle, color

        // Clear Context
        this.clear()

        // Configure Context
        this.context.lineJoin = 'round'
        this.context.lineWidth = 1

        // Update Meshes
        for (m = scene.meshes.length - 1; m >= 0; m--) {
            mesh = scene.meshes[m]
            if (mesh.visible) {
                mesh.update(scene.light, true)

                // Render Triangles
                for (t = mesh.geometry.triangles.length - 1; t >= 0; t--) {
                    triangle = mesh.geometry.triangles[t]

                    var strokeColor = triangle.lineColor.format()
                    var fillColor = triangle.color.format()

                    this.context.beginPath()
                    this.context.moveTo(triangle.a.position[0], triangle.a.position[1])
                    this.context.lineTo(triangle.b.position[0], triangle.b.position[1])
                    this.context.lineTo(triangle.c.position[0], triangle.c.position[1])
                    this.context.closePath()

                    this.context.strokeStyle = strokeColor
                    this.context.stroke()

                    this.context.fillStyle = fillColor
                    this.context.fill()
                }
            }
        }

        return this
    }
}

/**
 * @class WebGL Renderer
 * @author Matthew Wagerfield
 */
class WebGLRenderer extends Renderer {
    constructor() {
        super()

        this.element = document.createElement('canvas')
        this.element.style.display = 'block'

        // Set initial vertex and light count
        this.vertices = null
        this.light = null

        // Create parameters object
        var parameters = {
            preserveDrawingBuffer: false,
            premultipliedAlpha: true,
            antialias: true,
            stencil: true,
            alpha: true
        }

        // Create and configure the gl context
        this.gl = this.getContext(this.element, parameters)

        // Set the internal support flag
        this.unsupported = !this.gl

        // Setup renderer
        if (this.unsupported) {
            return 'WebGL is not supported by your browser.'
        } else {
            this.gl.clearColor(0.0, 0.0, 0.0, 0.0)
            this.gl.enable(this.gl.DEPTH_TEST)
            this.setSize(this.element.width, this.element.height)
        }
    }

    static VS(light) {
        var shader = [
            // Precision
            'precision mediump float',

            // Attributes
            'attribute int aSide',
            'attribute vec3 aPosition',
            'attribute vec3 aCentroid',
            'attribute vec3 aNormal',
            'attribute vec4 aAmbient',
            'attribute vec4 aDiffuse',

            // Uniforms
            'uniform vec3 uResolution',
            'uniform vec3 lightPosition',
            'uniform vec4 lightAmbient',
            'uniform vec4 uLightDiffuse',

            // Varyings
            'varying vec4 vColor',

            // Main
            'void main() {',

            // Create color
            'vColor = vec4(0.0)',

            // Calculate the vertex position
            'vec3 position = aPosition / uResolution * 2.0',

            // Calculate illuminance
            'vec3 ray = normalize(lightPosition - aCentroid)',
            'float illuminance = dot(aNormal, ray)',

            'if (aSide == 0) {',
            'illuminance = max(illuminance, 0.0)',
            '} else if (aSide == 1) {',
            'illuminance = abs(min(illuminance, 0.0))',
            '} else if (aSide == 2) {',
            'illuminance = max(abs(illuminance), 0.0)',
            '}',

            // Calculate ambient light
            'vColor += aAmbient * lightAmbient',

            // Calculate diffuse light
            'vColor += aDiffuse * lightDiffuse * illuminance',

            // Clamp color
            'vColor = clamp(vColor, 0.0, 1.0)',

            // Set gl_Position
            'gl_Position = vec4(position, 1.0)',

            '}'
        ].join('\n')

        // Return the shader
        return shader
    }

    static FS(light) {
        var shader = [
            // Precision
            'precision mediump float',

            // Varyings
            'varying vec4 vColor',

            // Main
            'void main() {',

            // Set gl_FragColor
            'gl_FragColor = vColor',

            '}'
            // Return the shader
        ].join('\n')
        return shader
    }

    getContext(canvas, parameters) {
        var context = false
        try {
            if (!(context = canvas.getContext('experimental-webgl', parameters))) {
                throw 'Error creating WebGL context.'
            }
        } catch (error) {
            console.error(error)
        }
        return context
    }

    setSize(width, height) {
        Renderer.prototype.setSize.call(this, width, height)
        if (this.unsupported) return

        // Set the size of the canvas element
        this.element.width = width
        this.element.height = height

        // Set the size of the gl viewport
        this.gl.viewport(0, 0, width, height)
        return this
    }

    clear() {
        Renderer.prototype.clear.call(this)
        if (this.unsupported) return
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT)
        return this
    }

    render(scene) {
        Renderer.prototype.render.call(this, scene)
        if (this.unsupported) return
        var m, mesh, t, tl, triangle, l, light, attribute, uniform, buffer, data, location, update = false,
            light = scene.light,
            index, v, vl, vertex, vertices = 0

        // Clear context
        this.clear()

        // Build the shader program
        if (this.light !== light) {
            this.light = light
            if (this.light != null) {
                this.buildProgram(light)
            } else {
                return
            }
        }

        // Update program
        if (!!this.program) {

            // Increment vertex counter
            for (m = scene.meshes.length - 1; m >= 0; m--) {
                mesh = scene.meshes[m]
                if (mesh.geometry.dirty) update = true
                mesh.update(scene.light, false)
                vertices += mesh.geometry.triangles.length * 3
            }

            // Compare vertex counter
            if (update || this.vertices !== vertices) {
                this.vertices = vertices

                // Build buffers
                for (attribute in this.program.attributes) {
                    buffer = this.program.attributes[attribute]
                    buffer.data = new Array(vertices * buffer.size)

                    // Reset vertex index
                    index = 0

                    // Update attribute buffer data
                    for (m = scene.meshes.length - 1; m >= 0; m--) {
                        mesh = scene.meshes[m]

                        for (t = 0, tl = mesh.geometry.triangles.length; t < tl; t++) {
                            triangle = mesh.geometry.triangles[t]

                            for (v = 0, vl = triangle.vertices.length; v < vl; v++) {
                                vertex = triangle.vertices[v]
                                switch (attribute) {
                                    case 'side':
                                        this.setBufferData(index, buffer, mesh.side)
                                        break
                                    case 'position':
                                        this.setBufferData(index, buffer, vertex.position)
                                        break
                                    case 'centroid':
                                        this.setBufferData(index, buffer, triangle.centroid)
                                        break
                                    case 'normal':
                                        this.setBufferData(index, buffer, triangle.normal)
                                        break
                                    case 'ambient':
                                        this.setBufferData(index, buffer, mesh.material.ambient.rgba)
                                        break
                                    case 'diffuse':
                                        this.setBufferData(index, buffer, mesh.material.diffuse.rgba)
                                        break
                                }
                                index++
                            }
                        }
                    }

                    // Upload attribute buffer data
                    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer.buffer)
                    this.gl.bufferData(this.gl.ARRAY_BUFFER, buffer.data, this.gl.DYNAMIC_DRAW)
                    this.gl.enableVertexAttribArray(buffer.location)
                    this.gl.vertexAttribPointer(buffer.location, buffer.size, this.gl.FLOAT, false, 0, 0)
                }
            }

            // Build uniform buffers
            this.setBufferData(0, this.program.uniforms.resolution, [this.width, this.height, this.width])
            light = scene.light
            this.setBufferData(this.program.uniforms.lightPosition, light.position)
            this.setBufferData(this.program.uniforms.lightAmbient, light.ambient.rgba)
            this.setBufferData(this.program.uniforms.lightDiffuse, light.diffuse.rgba)

            // Update uniforms
            for (uniform in this.program.uniforms) {
                buffer = this.program.uniforms[uniform]
                location = buffer.location
                data = buffer.data
                switch (buffer.structure) {
                    case '3f':
                        this.gl.uniform3f(location, data[0], data[1], data[2])
                        break
                    case '3fv':
                        this.gl.uniform3fv(location, data)
                        break
                    case '4fv':
                        this.gl.uniform4fv(location, data)
                        break
                }
            }
        }

        // Draw those lovely triangles
        this.gl.drawArrays(this.gl.TRIANGLES, 0, this.vertices)
        return this
    }

    setBufferData(buffer, value) {
        if (Utils.isNumber(value)) {
            buffer.data[buffer.size] = value
        } else {
            for (var i = value.length - 1; i >= 0; i--) {
                buffer.data[buffer.size + i] = value[i]
            }
        }
    }

    /**
     * Concepts taken from three.js WebGLRenderer
     * @see https://github.com/mrdoob/three.js/blob/master/src/renderers/WebGLRenderer.js
     */
    buildProgram(light) {
        if (this.unsupported) return

        // Create shader source
        var vs = WebGLRenderer.VS(light)
        var fs = WebGLRenderer.FS(light)

        // Derive the shader fingerprint
        var code = vs + fs

        // Check if the program has already been compiled
        if (!!this.program && this.program.code === code) return

        // Create the program and shaders
        var program = this.gl.createProgram()
        var vertexShader = this.buildShader(this.gl.VERTEX_SHADER, vs)
        var fragmentShader = this.buildShader(this.gl.FRAGMENT_SHADER, fs)

        // Attach an link the shader
        this.gl.attachShader(program, vertexShader)
        this.gl.attachShader(program, fragmentShader)
        this.gl.linkProgram(program)

        // Add error handling
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            var error = this.gl.getError()
            var status = this.gl.getProgramParameter(program, this.gl.VALIDATE_STATUS)
            console.error('Could not initialise shader.\nVALIDATE_STATUS: ' + status + '\nERROR: ' + error)
            return null
        }

        // Delete the shader
        this.gl.deleteShader(fragmentShader)
        this.gl.deleteShader(vertexShader)

        // Set the program code
        program.code = code

        // Add the program attributes
        program.attributes = {
            side: this.buildBuffer(program, 'attribute', 'aSide', 1, 'f'),
            position: this.buildBuffer(program, 'attribute', 'aPosition', 3, 'v3'),
            centroid: this.buildBuffer(program, 'attribute', 'aCentroid', 3, 'v3'),
            normal: this.buildBuffer(program, 'attribute', 'aNormal', 3, 'v3'),
            ambient: this.buildBuffer(program, 'attribute', 'aAmbient', 4, 'v4'),
            diffuse: this.buildBuffer(program, 'attribute', 'aDiffuse', 4, 'v4')
        }

        // Add the program uniforms
        program.uniforms = {
            resolution: this.buildBuffer(program, 'uniform', 'uResolution', 3, '3f', 1),
            lightPosition: this.buildBuffer(program, 'uniform', 'uLightPosition', 3, '3fv', light),
            lightAmbient: this.buildBuffer(program, 'uniform', 'uLightAmbient', 4, '4fv', light),
            lightDiffuse: this.buildBuffer(program, 'uniform', 'uLightDiffuse', 4, '4fv', light)
        }

        // Set the renderer program
        this.program = program

        // Enable program
        this.gl.useProgram(this.program)

        // Return the program
        return program
    }

    buildShader(type, source) {
        if (this.unsupported) return

        // Create and compile shader
        var shader = this.gl.createShader(type)
        this.gl.shaderSource(shader, source)
        this.gl.compileShader(shader)

        // Add error handling
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error(this.gl.getShaderInfoLog(shader))
            return null
        }

        // Return the shader
        return shader
    }

    buildBuffer(program, type, identifier, size, structure, count) {
        var buffer = {
            buffer: this.gl.createBuffer(),
            size: size,
            structure: structure,
            data: null
        }

        // Set the location
        switch (type) {
            case 'attribute':
                buffer.location = this.gl.getAttribLocation(program, identifier)
                break
            case 'uniform':
                buffer.location = this.gl.getUniformLocation(program, identifier)
                break
        }

        // Create the buffer if count is provided
        if (!!count) {
            buffer.data = new Array(count * size)
        }

        // Return the buffer
        return buffer
    }
}

/**
 * @class SVG Renderer
 * @author Matthew Wagerfield
 */
class SVGRenderer extends Renderer {
    constructor() {
        super()

        this.element = document.createElementNS(FSS.SVGNS, 'svg')
        this.element.setAttribute('xmlns', FSS.SVGNS)
        this.element.setAttribute('version', '1.1')
        this.element.style.display = 'block'
        this.setSize(300, 150)
    }

    setSize(width, height) {
        Renderer.prototype.setSize.call(this, width, height)
        this.element.setAttribute('width', width)
        this.element.setAttribute('height', height)
        return this
    }

    clear() {
        Renderer.prototype.clear.call(this)
        for (var i = this.element.childNodes.length - 1; i >= 0; i--) {
            this.element.removeChild(this.element.childNodes[i])
        }
        return this
    }

    render(scene) {
        Renderer.prototype.render.call(this, scene)
        var m, mesh, t, triangle, points, style

        // Update Meshes
        for (m = scene.meshes.length - 1; m >= 0; m--) {
            mesh = scene.meshes[m]
            if (mesh.visible) {
                mesh.update(scene.light, true)

                // Render Triangles
                for (t = mesh.geometry.triangles.length - 1; t >= 0; t--) {
                    triangle = mesh.geometry.triangles[t]
                    if (triangle.polygon.parentNode !== this.element) {
                        this.element.appendChild(triangle.polygon)
                    }
                    points = this.formatPoint(triangle.a) + ' '
                    points += this.formatPoint(triangle.b) + ' '
                    points += this.formatPoint(triangle.c)
                    style = this.formatStyle(triangle.color.format())
                    triangle.polygon.setAttributeNS(null, 'points', points)
                    triangle.polygon.setAttributeNS(null, 'style', style)
                }
            }
        }
        return this
    }

    formatPoint(vertex) {
        return (this.halfWidth + vertex.position[0]) + ',' + (this.halfHeight - vertex.position[1])
    }

    formatStyle(color) {
        var style = 'fill:' + color + ''
        style += 'stroke:' + color + ''
        return style
    }
}
// #endregion

// #region dat-gui
/**
 * dat-gui JavaScript Controller Library
 * https://code.google.com/p/dat-gui
 *
 * Copyright 2011 Data Arts Team, Google Creative Lab
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 */
var dat = dat || {};
dat.gui = dat.gui || {};
dat.utils = dat.utils || {};
dat.controllers = dat.controllers || {};
dat.dom = dat.dom || {};
dat.color = dat.color || {};
dat.utils.css = function () {
    return {
        load: function (e, a) {
            var a = a || document,
                c = a.createElement("link");
            c.type = "text/css";
            c.rel = "stylesheet";
            c.href = e;
            a.getElementsByTagName("head")[0].appendChild(c)
        },
        inject: function (e, a) {
            var a = a || document,
                c = document.createElement("style");
            c.type = "text/css";
            c.innerHTML = e;
            a.getElementsByTagName("head")[0].appendChild(c)
        }
    }
}();
dat.utils.common = function () {
    var e = Array.prototype.forEach,
        a = Array.prototype.slice;
    return {
        BREAK: {},
        extend: function (c) {
            this.each(a.call(arguments, 1), function (a) {
                for (var f in a) this.isUndefined(a[f]) || (c[f] = a[f])
            }, this);
            return c
        },
        defaults: function (c) {
            this.each(a.call(arguments, 1), function (a) {
                for (var f in a) this.isUndefined(c[f]) && (c[f] = a[f])
            }, this);
            return c
        },
        compose: function () {
            var c = a.call(arguments);
            return function () {
                for (var d = a.call(arguments), f = c.length - 1; f >= 0; f--) d = [c[f].apply(this, d)];
                return d[0]
            }
        },
        each: function (a, d, f) {
            if (e && a.forEach === e) a.forEach(d, f);
            else if (a.length === a.length + 0)
                for (var b = 0, n = a.length; b < n; b++) {
                    if (b in a && d.call(f, a[b], b) === this.BREAK) break
                } else
                    for (b in a)
                        if (d.call(f, a[b], b) === this.BREAK) break
        },
        defer: function (a) {
            setTimeout(a, 0)
        },
        toArray: function (c) {
            return c.toArray ? c.toArray() : a.call(c)
        },
        isUndefined: function (a) {
            return a === void 0
        },
        isNull: function (a) {
            return a === null
        },
        isNaN: function (a) {
            return a !== a
        },
        isArray: Array.isArray || function (a) {
            return a.constructor === Array
        },
        isObject: function (a) {
            return a === Object(a)
        },
        isNumber: function (a) {
            return a === a + 0
        },
        isString: function (a) {
            return a === a + ""
        },
        isBoolean: function (a) {
            return a === false || a === true
        },
        isFunction: function (a) {
            return Object.prototype.toString.call(a) === "[object Function]"
        }
    }
}();
dat.controllers.Controller = function (e) {
    var a = function (a, d) {
        this.initialValue = a[d];
        this.domElement = document.createElement("div");
        this.object = a;
        this.property = d;
        this.__onFinishChange = this.__onChange = void 0
    };
    e.extend(a.prototype, {
        onChange: function (a) {
            this.__onChange = a;
            return this
        },
        onFinishChange: function (a) {
            this.__onFinishChange = a;
            return this
        },
        setValue: function (a) {
            this.object[this.property] = a;
            this.__onChange && this.__onChange.call(this, a);
            this.updateDisplay();
            return this
        },
        getValue: function () {
            return this.object[this.property]
        },
        updateDisplay: function () {
            return this
        },
        isModified: function () {
            return this.initialValue !== this.getValue()
        }
    });
    return a
}(dat.utils.common);
dat.dom.dom = function (e) {
    function a(b) {
        if (b === "0" || e.isUndefined(b)) return 0;
        b = b.match(d);
        return !e.isNull(b) ? parseFloat(b[1]) : 0
    }
    var c = {};
    e.each({
        HTMLEvents: ["change"],
        MouseEvents: ["click", "mousemove", "mousedown", "mouseup", "mouseover"],
        KeyboardEvents: ["keydown"]
    }, function (b, a) {
        e.each(b, function (b) {
            c[b] = a
        })
    });
    var d = /(\d+(\.\d+)?)px/,
        f = {
            makeSelectable: function (b, a) {
                if (!(b === void 0 || b.style === void 0)) b.onselectstart = a ? function () {
                        return false
                    } : function () {}, b.style.MozUserSelect = a ? "auto" : "none", b.style.KhtmlUserSelect =
                    a ? "auto" : "none", b.unselectable = a ? "on" : "off"
            },
            makeFullscreen: function (b, a, d) {
                e.isUndefined(a) && (a = true);
                e.isUndefined(d) && (d = true);
                b.style.position = "absolute";
                if (a) b.style.left = 0, b.style.right = 0;
                if (d) b.style.top = 0, b.style.bottom = 0
            },
            fakeEvent: function (b, a, d, f) {
                var d = d || {},
                    m = c[a];
                if (!m) throw Error("Event type " + a + " not supported.");
                var l = document.createEvent(m);
                switch (m) {
                    case "MouseEvents":
                        l.initMouseEvent(a, d.bubbles || false, d.cancelable || true, window, d.clickCount || 1, 0, 0, d.x || d.clientX || 0, d.y || d.clientY ||
                            0, false, false, false, false, 0, null);
                        break;
                    case "KeyboardEvents":
                        m = l.initKeyboardEvent || l.initKeyEvent;
                        e.defaults(d, {
                            cancelable: true,
                            ctrlKey: false,
                            altKey: false,
                            shiftKey: false,
                            metaKey: false,
                            keyCode: void 0,
                            charCode: void 0
                        });
                        m(a, d.bubbles || false, d.cancelable, window, d.ctrlKey, d.altKey, d.shiftKey, d.metaKey, d.keyCode, d.charCode);
                        break;
                    default:
                        l.initEvent(a, d.bubbles || false, d.cancelable || true)
                }
                e.defaults(l, f);
                b.dispatchEvent(l)
            },
            bind: function (b, a, d, c) {
                b.addEventListener ? b.addEventListener(a, d, c || false) : b.attachEvent &&
                    b.attachEvent("on" + a, d);
                return f
            },
            unbind: function (b, a, d, c) {
                b.removeEventListener ? b.removeEventListener(a, d, c || false) : b.detachEvent && b.detachEvent("on" + a, d);
                return f
            },
            addClass: function (b, a) {
                if (b.className === void 0) b.className = a;
                else if (b.className !== a) {
                    var d = b.className.split(/ +/);
                    if (d.indexOf(a) == -1) d.push(a), b.className = d.join(" ").replace(/^\s+/, "").replace(/\s+$/, "")
                }
                return f
            },
            removeClass: function (b, a) {
                if (a) {
                    if (b.className !== void 0)
                        if (b.className === a) b.removeAttribute("class");
                        else {
                            var d = b.className.split(/ +/),
                                c = d.indexOf(a);
                            if (c != -1) d.splice(c, 1), b.className = d.join(" ")
                        }
                } else b.className = void 0;
                return f
            },
            hasClass: function (a, d) {
                return RegExp("(?:^|\\s+)" + d + "(?:\\s+|$)").test(a.className) || false
            },
            getWidth: function (b) {
                b = getComputedStyle(b);
                return a(b["border-left-width"]) + a(b["border-right-width"]) + a(b["padding-left"]) + a(b["padding-right"]) + a(b.width)
            },
            getHeight: function (b) {
                b = getComputedStyle(b);
                return a(b["border-top-width"]) + a(b["border-bottom-width"]) + a(b["padding-top"]) + a(b["padding-bottom"]) + a(b.height)
            },
            getOffset: function (a) {
                var d = {
                    left: 0,
                    top: 0
                };
                if (a.offsetParent) {
                    do d.left += a.offsetLeft, d.top += a.offsetTop; while (a = a.offsetParent)
                }
                return d
            },
            isActive: function (a) {
                return a === document.activeElement && (a.type || a.href)
            }
        };
    return f
}(dat.utils.common);
dat.controllers.OptionController = function (e, a, c) {
    var d = function (f, b, e) {
        d.superclass.call(this, f, b);
        var h = this;
        this.__select = document.createElement("select");
        if (c.isArray(e)) {
            var j = {};
            c.each(e, function (a) {
                j[a] = a
            });
            e = j
        }
        c.each(e, function (a, b) {
            var d = document.createElement("option");
            d.innerHTML = b;
            d.setAttribute("value", a);
            h.__select.appendChild(d)
        });
        this.updateDisplay();
        a.bind(this.__select, "change", function () {
            h.setValue(this.options[this.selectedIndex].value)
        });
        this.domElement.appendChild(this.__select)
    };
    d.superclass = e;
    c.extend(d.prototype, e.prototype, {
        setValue: function (a) {
            a = d.superclass.prototype.setValue.call(this, a);
            this.__onFinishChange && this.__onFinishChange.call(this, this.getValue());
            return a
        },
        updateDisplay: function () {
            this.__select.value = this.getValue();
            return d.superclass.prototype.updateDisplay.call(this)
        }
    });
    return d
}(dat.controllers.Controller, dat.dom.dom, dat.utils.common);
dat.controllers.NumberController = function (e, a) {
    var c = function (d, f, b) {
        c.superclass.call(this, d, f);
        b = b || {};
        this.__min = b.min;
        this.__max = b.max;
        this.__step = b.step;
        d = this.__impliedStep = a.isUndefined(this.__step) ? this.initialValue == 0 ? 1 : Math.pow(10, Math.floor(Math.log(this.initialValue) / Math.LN10)) / 10 : this.__step;
        d = d.toString();
        this.__precision = d.indexOf(".") > -1 ? d.length - d.indexOf(".") - 1 : 0
    };
    c.superclass = e;
    a.extend(c.prototype, e.prototype, {
        setValue: function (a) {
            if (this.__min !== void 0 && a < this.__min) a = this.__min;
            else if (this.__max !== void 0 && a > this.__max) a = this.__max;
            this.__step !== void 0 && a % this.__step != 0 && (a = Math.round(a / this.__step) * this.__step);
            return c.superclass.prototype.setValue.call(this, a)
        },
        min: function (a) {
            this.__min = a;
            return this
        },
        max: function (a) {
            this.__max = a;
            return this
        },
        step: function (a) {
            this.__step = a;
            return this
        }
    });
    return c
}(dat.controllers.Controller, dat.utils.common);
dat.controllers.NumberControllerBox = function (e, a, c) {
    var d = function (f, b, e) {
        function h() {
            var a = parseFloat(l.__input.value);
            c.isNaN(a) || l.setValue(a)
        }

        function j(a) {
            var b = o - a.clientY;
            l.setValue(l.getValue() + b * l.__impliedStep);
            o = a.clientY
        }

        function m() {
            a.unbind(window, "mousemove", j);
            a.unbind(window, "mouseup", m)
        }
        this.__truncationSuspended = false;
        d.superclass.call(this, f, b, e);
        var l = this,
            o;
        this.__input = document.createElement("input");
        this.__input.setAttribute("type", "text");
        a.bind(this.__input, "change", h);
        a.bind(this.__input, "blur", function () {
            h();
            l.__onFinishChange && l.__onFinishChange.call(l, l.getValue())
        });
        a.bind(this.__input, "mousedown", function (b) {
            a.bind(window, "mousemove", j);
            a.bind(window, "mouseup", m);
            o = b.clientY
        });
        a.bind(this.__input, "keydown", function (a) {
            if (a.keyCode === 13) l.__truncationSuspended = true, this.blur(), l.__truncationSuspended = false
        });
        this.updateDisplay();
        this.domElement.appendChild(this.__input)
    };
    d.superclass = e;
    c.extend(d.prototype, e.prototype, {
        updateDisplay: function () {
            var a = this.__input,
                b;
            if (this.__truncationSuspended) b = this.getValue();
            else {
                b = this.getValue();
                var c = Math.pow(10, this.__precision);
                b = Math.round(b * c) / c
            }
            a.value = b;
            return d.superclass.prototype.updateDisplay.call(this)
        }
    });
    return d
}(dat.controllers.NumberController, dat.dom.dom, dat.utils.common);
dat.controllers.NumberControllerSlider = function (e, a, c, d, f) {
    var b = function (d, c, f, e, l) {
        function o(b) {
            b.preventDefault();
            var d = a.getOffset(g.__background),
                c = a.getWidth(g.__background);
            g.setValue(g.__min + (g.__max - g.__min) * ((b.clientX - d.left) / (d.left + c - d.left)));
            return false
        }

        function y() {
            a.unbind(window, "mousemove", o);
            a.unbind(window, "mouseup", y);
            g.__onFinishChange && g.__onFinishChange.call(g, g.getValue())
        }
        b.superclass.call(this, d, c, {
            min: f,
            max: e,
            step: l
        });
        var g = this;
        this.__background = document.createElement("div");
        this.__foreground = document.createElement("div");
        a.bind(this.__background, "mousedown", function (b) {
            a.bind(window, "mousemove", o);
            a.bind(window, "mouseup", y);
            o(b)
        });
        a.addClass(this.__background, "slider");
        a.addClass(this.__foreground, "slider-fg");
        this.updateDisplay();
        this.__background.appendChild(this.__foreground);
        this.domElement.appendChild(this.__background)
    };
    b.superclass = e;
    b.useDefaultStyles = function () {
        c.inject(f)
    };
    d.extend(b.prototype, e.prototype, {
        updateDisplay: function () {
            this.__foreground.style.width =
                (this.getValue() - this.__min) / (this.__max - this.__min) * 100 + "%";
            return b.superclass.prototype.updateDisplay.call(this)
        }
    });
    return b
}(dat.controllers.NumberController, dat.dom.dom, dat.utils.css, dat.utils.common, ".slider {\n  box-shadow: inset 0 2px 4px rgba(0,0,0,0.15);\n  height: 1em;\n  border-radius: 1em;\n  background-color: #eee;\n  padding: 0 0.5em;\n  overflow: hidden;\n}\n\n.slider-fg {\n  padding: 1px 0 2px 0;\n  background-color: #aaa;\n  height: 1em;\n  margin-left: -0.5em;\n  padding-right: 0.5em;\n  border-radius: 1em 0 0 1em;\n}\n\n.slider-fg:after {\n  display: inline-block;\n  border-radius: 1em;\n  background-color: #fff;\n  border:  1px solid #aaa;\n  content: '';\n  float: right;\n  margin-right: -1em;\n  margin-top: -1px;\n  height: 0.9em;\n  width: 0.9em;\n}");
dat.controllers.FunctionController = function (e, a, c) {
    var d = function (c, b, e) {
        d.superclass.call(this, c, b);
        var h = this;
        this.__button = document.createElement("div");
        this.__button.innerHTML = e === void 0 ? "Fire" : e;
        a.bind(this.__button, "click", function (a) {
            a.preventDefault();
            h.fire();
            return false
        });
        a.addClass(this.__button, "button");
        this.domElement.appendChild(this.__button)
    };
    d.superclass = e;
    c.extend(d.prototype, e.prototype, {
        fire: function () {
            this.__onChange && this.__onChange.call(this);
            this.__onFinishChange && this.__onFinishChange.call(this,
                this.getValue());
            this.getValue().call(this.object)
        }
    });
    return d
}(dat.controllers.Controller, dat.dom.dom, dat.utils.common);
dat.controllers.BooleanController = function (e, a, c) {
    var d = function (c, b) {
        d.superclass.call(this, c, b);
        var e = this;
        this.__prev = this.getValue();
        this.__checkbox = document.createElement("input");
        this.__checkbox.setAttribute("type", "checkbox");
        a.bind(this.__checkbox, "change", function () {
            e.setValue(!e.__prev)
        }, false);
        this.domElement.appendChild(this.__checkbox);
        this.updateDisplay()
    };
    d.superclass = e;
    c.extend(d.prototype, e.prototype, {
        setValue: function (a) {
            a = d.superclass.prototype.setValue.call(this, a);
            this.__onFinishChange &&
                this.__onFinishChange.call(this, this.getValue());
            this.__prev = this.getValue();
            return a
        },
        updateDisplay: function () {
            this.getValue() === true ? (this.__checkbox.setAttribute("checked", "checked"), this.__checkbox.checked = true) : this.__checkbox.checked = false;
            return d.superclass.prototype.updateDisplay.call(this)
        }
    });
    return d
}(dat.controllers.Controller, dat.dom.dom, dat.utils.common);
dat.color.toString = function (e) {
    return function (a) {
        if (a.a == 1 || e.isUndefined(a.a)) {
            for (a = a.hex.toString(16); a.length < 6;) a = "0" + a;
            return "#" + a
        } else return "rgba(" + Math.round(a.r) + "," + Math.round(a.g) + "," + Math.round(a.b) + "," + a.a + ")"
    }
}(dat.utils.common);
dat.color.interpret = function (e, a) {
    var c, d, f = [{
        litmus: a.isString,
        conversions: {
            THREE_CHAR_HEX: {
                read: function (a) {
                    a = a.match(/^#([A-F0-9])([A-F0-9])([A-F0-9])$/i);
                    return a === null ? false : {
                        space: "HEX",
                        hex: parseInt("0x" + a[1].toString() + a[1].toString() + a[2].toString() + a[2].toString() + a[3].toString() + a[3].toString())
                    }
                },
                write: e
            },
            SIX_CHAR_HEX: {
                read: function (a) {
                    a = a.match(/^#([A-F0-9]{6})$/i);
                    return a === null ? false : {
                        space: "HEX",
                        hex: parseInt("0x" + a[1].toString())
                    }
                },
                write: e
            },
            CSS_RGB: {
                read: function (a) {
                    a = a.match(/^rgb\(\s*(.+)\s*,\s*(.+)\s*,\s*(.+)\s*\)/);
                    return a === null ? false : {
                        space: "RGB",
                        r: parseFloat(a[1]),
                        g: parseFloat(a[2]),
                        b: parseFloat(a[3])
                    }
                },
                write: e
            },
            CSS_RGBA: {
                read: function (a) {
                    a = a.match(/^rgba\(\s*(.+)\s*,\s*(.+)\s*,\s*(.+)\s*\,\s*(.+)\s*\)/);
                    return a === null ? false : {
                        space: "RGB",
                        r: parseFloat(a[1]),
                        g: parseFloat(a[2]),
                        b: parseFloat(a[3]),
                        a: parseFloat(a[4])
                    }
                },
                write: e
            }
        }
    }, {
        litmus: a.isNumber,
        conversions: {
            HEX: {
                read: function (a) {
                    return {
                        space: "HEX",
                        hex: a,
                        conversionName: "HEX"
                    }
                },
                write: function (a) {
                    return a.hex
                }
            }
        }
    }, {
        litmus: a.isArray,
        conversions: {
            RGB_ARRAY: {
                read: function (a) {
                    return a.length !=
                        3 ? false : {
                            space: "RGB",
                            r: a[0],
                            g: a[1],
                            b: a[2]
                        }
                },
                write: function (a) {
                    return [a.r, a.g, a.b]
                }
            },
            RGBA_ARRAY: {
                read: function (a) {
                    return a.length != 4 ? false : {
                        space: "RGB",
                        r: a[0],
                        g: a[1],
                        b: a[2],
                        a: a[3]
                    }
                },
                write: function (a) {
                    return [a.r, a.g, a.b, a.a]
                }
            }
        }
    }, {
        litmus: a.isObject,
        conversions: {
            RGBA_OBJ: {
                read: function (b) {
                    return a.isNumber(b.r) && a.isNumber(b.g) && a.isNumber(b.b) && a.isNumber(b.a) ? {
                        space: "RGB",
                        r: b.r,
                        g: b.g,
                        b: b.b,
                        a: b.a
                    } : false
                },
                write: function (a) {
                    return {
                        r: a.r,
                        g: a.g,
                        b: a.b,
                        a: a.a
                    }
                }
            },
            RGB_OBJ: {
                read: function (b) {
                    return a.isNumber(b.r) &&
                        a.isNumber(b.g) && a.isNumber(b.b) ? {
                            space: "RGB",
                            r: b.r,
                            g: b.g,
                            b: b.b
                        } : false
                },
                write: function (a) {
                    return {
                        r: a.r,
                        g: a.g,
                        b: a.b
                    }
                }
            },
            HSVA_OBJ: {
                read: function (b) {
                    return a.isNumber(b.h) && a.isNumber(b.s) && a.isNumber(b.v) && a.isNumber(b.a) ? {
                        space: "HSV",
                        h: b.h,
                        s: b.s,
                        v: b.v,
                        a: b.a
                    } : false
                },
                write: function (a) {
                    return {
                        h: a.h,
                        s: a.s,
                        v: a.v,
                        a: a.a
                    }
                }
            },
            HSV_OBJ: {
                read: function (b) {
                    return a.isNumber(b.h) && a.isNumber(b.s) && a.isNumber(b.v) ? {
                        space: "HSV",
                        h: b.h,
                        s: b.s,
                        v: b.v
                    } : false
                },
                write: function (a) {
                    return {
                        h: a.h,
                        s: a.s,
                        v: a.v
                    }
                }
            }
        }
    }];
    return function () {
        d =
            false;
        var b = arguments.length > 1 ? a.toArray(arguments) : arguments[0];
        a.each(f, function (e) {
            if (e.litmus(b)) return a.each(e.conversions, function (e, f) {
                c = e.read(b);
                if (d === false && c !== false) return d = c, c.conversionName = f, c.conversion = e, a.BREAK
            }), a.BREAK
        });
        return d
    }
}(dat.color.toString, dat.utils.common);
dat.GUI = dat.gui.GUI = function (e, a, c, d, f, b, n, h, j, m, l, o, y, g, i) {
    function q(a, b, r, c) {
        if (b[r] === void 0) throw Error("Object " + b + ' has no property "' + r + '"');
        c.color ? b = new l(b, r) : (b = [b, r].concat(c.factoryArgs), b = d.apply(a, b));
        if (c.before instanceof f) c.before = c.before.__li;
        t(a, b);
        g.addClass(b.domElement, "c");
        r = document.createElement("span");
        g.addClass(r, "property-name");
        r.innerHTML = b.property;
        var e = document.createElement("div");
        e.appendChild(r);
        e.appendChild(b.domElement);
        c = s(a, e, c.before);
        g.addClass(c, k.CLASS_CONTROLLER_ROW);
        g.addClass(c, typeof b.getValue());
        p(a, c, b);
        a.__controllers.push(b);
        return b
    }

    function s(a, b, d) {
        var c = document.createElement("li");
        b && c.appendChild(b);
        d ? a.__ul.insertBefore(c, params.before) : a.__ul.appendChild(c);
        a.onResize();
        return c
    }

    function p(a, d, c) {
        c.__li = d;
        c.__gui = a;
        i.extend(c, {
            options: function (b) {
                if (arguments.length > 1) return c.remove(), q(a, c.object, c.property, {
                    before: c.__li.nextElementSibling,
                    factoryArgs: [i.toArray(arguments)]
                });
                if (i.isArray(b) || i.isObject(b)) return c.remove(), q(a, c.object, c.property, {
                    before: c.__li.nextElementSibling,
                    factoryArgs: [b]
                })
            },
            name: function (a) {
                c.__li.firstElementChild.firstElementChild.innerHTML = a;
                return c
            },
            listen: function () {
                c.__gui.listen(c);
                return c
            },
            remove: function () {
                c.__gui.remove(c);
                return c
            }
        });
        if (c instanceof j) {
            var e = new h(c.object, c.property, {
                min: c.__min,
                max: c.__max,
                step: c.__step
            });
            i.each(["updateDisplay", "onChange", "onFinishChange"], function (a) {
                var b = c[a],
                    H = e[a];
                c[a] = e[a] = function () {
                    var a = Array.prototype.slice.call(arguments);
                    b.apply(c, a);
                    return H.apply(e, a)
                }
            });
            g.addClass(d, "has-slider");
            c.domElement.insertBefore(e.domElement, c.domElement.firstElementChild)
        } else if (c instanceof h) {
            var f = function (b) {
                return i.isNumber(c.__min) && i.isNumber(c.__max) ? (c.remove(), q(a, c.object, c.property, {
                    before: c.__li.nextElementSibling,
                    factoryArgs: [c.__min, c.__max, c.__step]
                })) : b
            };
            c.min = i.compose(f, c.min);
            c.max = i.compose(f, c.max)
        } else if (c instanceof b) g.bind(d, "click", function () {
            g.fakeEvent(c.__checkbox, "click")
        }), g.bind(c.__checkbox, "click", function (a) {
            a.stopPropagation()
        });
        else if (c instanceof n) g.bind(d, "click", function () {
            g.fakeEvent(c.__button, "click")
        }), g.bind(d, "mouseover", function () {
            g.addClass(c.__button, "hover")
        }), g.bind(d, "mouseout", function () {
            g.removeClass(c.__button, "hover")
        });
        else if (c instanceof l) g.addClass(d, "color"), c.updateDisplay = i.compose(function (a) {
            d.style.borderLeftColor = c.__color.toString();
            return a
        }, c.updateDisplay), c.updateDisplay();
        c.setValue = i.compose(function (b) {
            a.getRoot().__preset_select && c.isModified() && B(a.getRoot(), true);
            return b
        }, c.setValue)
    }

    function t(a, b) {
        var c = a.getRoot(),
            d = c.__rememberedObjects.indexOf(b.object);
        if (d != -1) {
            var e = c.__rememberedObjectIndecesToControllers[d];
            e === void 0 && (e = {}, c.__rememberedObjectIndecesToControllers[d] = e);
            e[b.property] = b;
            if (c.load && c.load.remembered) {
                c = c.load.remembered;
                if (c[a.preset]) c = c[a.preset];
                else if (c[w]) c = c[w];
                else return;
                if (c[d] && c[d][b.property] !== void 0) d = c[d][b.property], b.initialValue = d, b.setValue(d)
            }
        }
    }

    function I(a) {
        var b = a.__save_row = document.createElement("li");
        g.addClass(a.domElement,
            "has-save");
        a.__ul.insertBefore(b, a.__ul.firstChild);
        g.addClass(b, "save-row");
        var c = document.createElement("span");
        c.innerHTML = "&nbsp;";
        g.addClass(c, "button gears");
        var d = document.createElement("span");
        d.innerHTML = "Save";
        g.addClass(d, "button");
        g.addClass(d, "save");
        var e = document.createElement("span");
        e.innerHTML = "New";
        g.addClass(e, "button");
        g.addClass(e, "save-as");
        var f = document.createElement("span");
        f.innerHTML = "Revert";
        g.addClass(f, "button");
        g.addClass(f, "revert");
        var m = a.__preset_select = document.createElement("select");
        a.load && a.load.remembered ? i.each(a.load.remembered, function (b, c) {
            C(a, c, c == a.preset)
        }) : C(a, w, false);
        g.bind(m, "change", function () {
            for (var b = 0; b < a.__preset_select.length; b++) a.__preset_select[b].innerHTML = a.__preset_select[b].value;
            a.preset = this.value
        });
        b.appendChild(m);
        b.appendChild(c);
        b.appendChild(d);
        b.appendChild(e);
        b.appendChild(f);
        if (u) {
            var b = document.getElementById("dg-save-locally"),
                l = document.getElementById("dg-local-explain");
            b.style.display = "block";
            b = document.getElementById("dg-local-storage");
            localStorage.getItem(document.location.href + ".isLocal") === "true" && b.setAttribute("checked", "checked");
            var o = function () {
                l.style.display = a.useLocalStorage ? "block" : "none"
            };
            o();
            g.bind(b, "change", function () {
                a.useLocalStorage = !a.useLocalStorage;
                o()
            })
        }
        var h = document.getElementById("dg-new-constructor");
        g.bind(h, "keydown", function (a) {
            a.metaKey && (a.which === 67 || a.keyCode == 67) && x.hide()
        });
        g.bind(c, "click", function () {
            h.innerHTML = JSON.stringify(a.getSaveObject(), void 0, 2);
            x.show();
            h.focus();
            h.select()
        });
        g.bind(d,
            "click",
            function () {
                a.save()
            });
        g.bind(e, "click", function () {
            var b = prompt("Enter a new preset name.");
            b && a.saveAs(b)
        });
        g.bind(f, "click", function () {
            a.revert()
        })
    }

    function J(a) {
        function b(f) {
            f.preventDefault();
            e = f.clientX;
            g.addClass(a.__closeButton, k.CLASS_DRAG);
            g.bind(window, "mousemove", c);
            g.bind(window, "mouseup", d);
            return false
        }

        function c(b) {
            b.preventDefault();
            a.width += e - b.clientX;
            a.onResize();
            e = b.clientX;
            return false
        }

        function d() {
            g.removeClass(a.__closeButton, k.CLASS_DRAG);
            g.unbind(window, "mousemove",
                c);
            g.unbind(window, "mouseup", d)
        }
        a.__resize_handle = document.createElement("div");
        i.extend(a.__resize_handle.style, {
            width: "6px",
            marginLeft: "-3px",
            height: "200px",
            cursor: "ew-resize",
            position: "absolute"
        });
        var e;
        g.bind(a.__resize_handle, "mousedown", b);
        g.bind(a.__closeButton, "mousedown", b);
        a.domElement.insertBefore(a.__resize_handle, a.domElement.firstElementChild)
    }

    function D(a, b) {
        a.domElement.style.width = b + "px";
        if (a.__save_row && a.autoPlace) a.__save_row.style.width = b + "px";
        if (a.__closeButton) a.__closeButton.style.width =
            b + "px"
    }

    function z(a, b) {
        var c = {};
        i.each(a.__rememberedObjects, function (d, e) {
            var f = {};
            i.each(a.__rememberedObjectIndecesToControllers[e], function (a, c) {
                f[c] = b ? a.initialValue : a.getValue()
            });
            c[e] = f
        });
        return c
    }

    function C(a, b, c) {
        var d = document.createElement("option");
        d.innerHTML = b;
        d.value = b;
        a.__preset_select.appendChild(d);
        if (c) a.__preset_select.selectedIndex = a.__preset_select.length - 1
    }

    function B(a, b) {
        var c = a.__preset_select[a.__preset_select.selectedIndex];
        c.innerHTML = b ? c.value + "*" : c.value
    }

    function E(a) {
        a.length !=
            0 && o(function () {
                E(a)
            });
        i.each(a, function (a) {
            a.updateDisplay()
        })
    }
    e.inject(c);
    var w = "Default",
        u;
    try {
        u = "localStorage" in window && window.localStorage !== null
    } catch (K) {
        u = false
    }
    var x, F = true,
        v, A = false,
        G = [],
        k = function (a) {
            function b() {
                localStorage.setItem(document.location.href + ".gui", JSON.stringify(d.getSaveObject()))
            }

            function c() {
                var a = d.getRoot();
                a.width += 1;
                i.defer(function () {
                    a.width -= 1
                })
            }
            var d = this;
            this.domElement = document.createElement("div");
            this.__ul = document.createElement("ul");
            this.domElement.appendChild(this.__ul);
            g.addClass(this.domElement, "dg");
            this.__folders = {};
            this.__controllers = [];
            this.__rememberedObjects = [];
            this.__rememberedObjectIndecesToControllers = [];
            this.__listening = [];
            a = a || {};
            a = i.defaults(a, {
                autoPlace: true,
                width: k.DEFAULT_WIDTH
            });
            a = i.defaults(a, {
                resizable: a.autoPlace,
                hideable: a.autoPlace
            });
            if (i.isUndefined(a.load)) a.load = {
                preset: w
            };
            else if (a.preset) a.load.preset = a.preset;
            i.isUndefined(a.parent) && a.hideable && G.push(this);
            a.resizable = i.isUndefined(a.parent) && a.resizable;
            if (a.autoPlace && i.isUndefined(a.scrollable)) a.scrollable =
                true;
            var e = u && localStorage.getItem(document.location.href + ".isLocal") === "true";
            Object.defineProperties(this, {
                parent: {
                    get: function () {
                        return a.parent
                    }
                },
                scrollable: {
                    get: function () {
                        return a.scrollable
                    }
                },
                autoPlace: {
                    get: function () {
                        return a.autoPlace
                    }
                },
                preset: {
                    get: function () {
                        return d.parent ? d.getRoot().preset : a.load.preset
                    },
                    set: function (b) {
                        d.parent ? d.getRoot().preset = b : a.load.preset = b;
                        for (b = 0; b < this.__preset_select.length; b++)
                            if (this.__preset_select[b].value == this.preset) this.__preset_select.selectedIndex =
                                b;
                        d.revert()
                    }
                },
                width: {
                    get: function () {
                        return a.width
                    },
                    set: function (b) {
                        a.width = b;
                        D(d, b)
                    }
                },
                name: {
                    get: function () {
                        return a.name
                    },
                    set: function (b) {
                        a.name = b;
                        if (m) m.innerHTML = a.name
                    }
                },
                closed: {
                    get: function () {
                        return a.closed
                    },
                    set: function (b) {
                        a.closed = b;
                        a.closed ? g.addClass(d.__ul, k.CLASS_CLOSED) : g.removeClass(d.__ul, k.CLASS_CLOSED);
                        this.onResize();
                        if (d.__closeButton) d.__closeButton.innerHTML = b ? k.TEXT_OPEN : k.TEXT_CLOSED
                    }
                },
                load: {
                    get: function () {
                        return a.load
                    }
                },
                useLocalStorage: {
                    get: function () {
                        return e
                    },
                    set: function (a) {
                        u &&
                            ((e = a) ? g.bind(window, "unload", b) : g.unbind(window, "unload", b), localStorage.setItem(document.location.href + ".isLocal", a))
                    }
                }
            });
            if (i.isUndefined(a.parent)) {
                a.closed = false;
                g.addClass(this.domElement, k.CLASS_MAIN);
                g.makeSelectable(this.domElement, false);
                if (u && e) {
                    d.useLocalStorage = true;
                    var f = localStorage.getItem(document.location.href + ".gui");
                    if (f) a.load = JSON.parse(f)
                }
                this.__closeButton = document.createElement("div");
                this.__closeButton.innerHTML = k.TEXT_CLOSED;
                g.addClass(this.__closeButton, k.CLASS_CLOSE_BUTTON);
                this.domElement.appendChild(this.__closeButton);
                g.bind(this.__closeButton, "click", function () {
                    d.closed = !d.closed
                })
            } else {
                if (a.closed === void 0) a.closed = true;
                var m = document.createTextNode(a.name);
                g.addClass(m, "controller-name");
                f = s(d, m);
                g.addClass(this.__ul, k.CLASS_CLOSED);
                g.addClass(f, "title");
                g.bind(f, "click", function (a) {
                    a.preventDefault();
                    d.closed = !d.closed;
                    return false
                });
                if (!a.closed) this.closed = false
            }
            a.autoPlace && (i.isUndefined(a.parent) && (F && (v = document.createElement("div"), g.addClass(v, "dg"), g.addClass(v,
                k.CLASS_AUTO_PLACE_CONTAINER), document.body.appendChild(v), F = false), v.appendChild(this.domElement), g.addClass(this.domElement, k.CLASS_AUTO_PLACE)), this.parent || D(d, a.width));
            g.bind(window, "resize", function () {
                d.onResize()
            });
            g.bind(this.__ul, "webkitTransitionEnd", function () {
                d.onResize()
            });
            g.bind(this.__ul, "transitionend", function () {
                d.onResize()
            });
            g.bind(this.__ul, "oTransitionEnd", function () {
                d.onResize()
            });
            this.onResize();
            a.resizable && J(this);
            d.getRoot();
            a.parent || c()
        };
    k.toggleHide = function () {
        A = !A;
        i.each(G,
            function (a) {
                a.domElement.style.zIndex = A ? -999 : 999;
                a.domElement.style.opacity = A ? 0 : 1
            })
    };
    k.CLASS_AUTO_PLACE = "a";
    k.CLASS_AUTO_PLACE_CONTAINER = "ac";
    k.CLASS_MAIN = "main";
    k.CLASS_CONTROLLER_ROW = "cr";
    k.CLASS_TOO_TALL = "taller-than-window";
    k.CLASS_CLOSED = "closed";
    k.CLASS_CLOSE_BUTTON = "close-button";
    k.CLASS_DRAG = "drag";
    k.DEFAULT_WIDTH = 245;
    k.TEXT_CLOSED = "Close Controls";
    k.TEXT_OPEN = "Open Controls";
    g.bind(window, "keydown", function (a) {
            document.activeElement.type !== "text" && (a.which === 72 || a.keyCode == 72) && k.toggleHide()
        },
        false);
    i.extend(k.prototype, {
        add: function (a, b) {
            return q(this, a, b, {
                factoryArgs: Array.prototype.slice.call(arguments, 2)
            })
        },
        addColor: function (a, b) {
            return q(this, a, b, {
                color: true
            })
        },
        remove: function (a) {
            this.__ul.removeChild(a.__li);
            this.__controllers.slice(this.__controllers.indexOf(a), 1);
            var b = this;
            i.defer(function () {
                b.onResize()
            })
        },
        destroy: function () {
            this.autoPlace && v.removeChild(this.domElement)
        },
        addFolder: function (a) {
            if (this.__folders[a] !== void 0) throw Error('You already have a folder in this GUI by the name "' +
                a + '"');
            var b = {
                name: a,
                parent: this
            };
            b.autoPlace = this.autoPlace;
            if (this.load && this.load.folders && this.load.folders[a]) b.closed = this.load.folders[a].closed, b.load = this.load.folders[a];
            b = new k(b);
            this.__folders[a] = b;
            a = s(this, b.domElement);
            g.addClass(a, "folder");
            return b
        },
        open: function () {
            this.closed = false
        },
        close: function () {
            this.closed = true
        },
        onResize: function () {
            var a = this.getRoot();
            if (a.scrollable) {
                var b = g.getOffset(a.__ul).top,
                    c = 0;
                i.each(a.__ul.childNodes, function (b) {
                    a.autoPlace && b === a.__save_row || (c +=
                        g.getHeight(b))
                });
                window.innerHeight - b - 20 < c ? (g.addClass(a.domElement, k.CLASS_TOO_TALL), a.__ul.style.height = window.innerHeight - b - 20 + "px") : (g.removeClass(a.domElement, k.CLASS_TOO_TALL), a.__ul.style.height = "auto")
            }
            a.__resize_handle && i.defer(function () {
                a.__resize_handle.style.height = a.__ul.offsetHeight + "px"
            });
            if (a.__closeButton) a.__closeButton.style.width = a.width + "px"
        },
        remember: function () {
            if (i.isUndefined(x)) x = new y, x.domElement.innerHTML = a;
            if (this.parent) throw Error("You can only call remember on a top level GUI.");
            var b = this;
            i.each(Array.prototype.slice.call(arguments), function (a) {
                b.__rememberedObjects.length == 0 && I(b);
                b.__rememberedObjects.indexOf(a) == -1 && b.__rememberedObjects.push(a)
            });
            this.autoPlace && D(this, this.width)
        },
        getRoot: function () {
            for (var a = this; a.parent;) a = a.parent;
            return a
        },
        getSaveObject: function () {
            var a = this.load;
            a.closed = this.closed;
            if (this.__rememberedObjects.length > 0) {
                a.preset = this.preset;
                if (!a.remembered) a.remembered = {};
                a.remembered[this.preset] = z(this)
            }
            a.folders = {};
            i.each(this.__folders, function (b,
                c) {
                a.folders[c] = b.getSaveObject()
            });
            return a
        },
        save: function () {
            if (!this.load.remembered) this.load.remembered = {};
            this.load.remembered[this.preset] = z(this);
            B(this, false)
        },
        saveAs: function (a) {
            if (!this.load.remembered) this.load.remembered = {}, this.load.remembered[w] = z(this, true);
            this.load.remembered[a] = z(this);
            this.preset = a;
            C(this, a, true)
        },
        revert: function (a) {
            i.each(this.__controllers, function (b) {
                this.getRoot().load.remembered ? t(a || this.getRoot(), b) : b.setValue(b.initialValue)
            }, this);
            i.each(this.__folders,
                function (a) {
                    a.revert(a)
                });
            a || B(this.getRoot(), false)
        },
        listen: function (a) {
            var b = this.__listening.length == 0;
            this.__listening.push(a);
            b && E(this.__listening)
        }
    });
    return k
}(dat.utils.css, '<div id="dg-save" class="dg dialogue">\n\n  Here\'s the new load parameter for your <code>GUI</code>\'s constructor:\n\n  <textarea id="dg-new-constructor"></textarea>\n\n  <div id="dg-save-locally">\n\n    <input id="dg-local-storage" type="checkbox"/> Automatically save\n    values to <code>localStorage</code> on exit.\n\n    <div id="dg-local-explain">The values saved to <code>localStorage</code> will\n      override those passed to <code>dat.GUI</code>\'s constructor. This makes it\n      easier to work incrementally, but <code>localStorage</code> is fragile,\n      and your friends may not see the same values you do.\n      \n    </div>\n    \n  </div>\n\n</div>',
    ".dg ul{list-style:none;margin:0;padding:0;width:100%;clear:both}.dg.ac{position:fixed;top:0;left:0;right:0;height:0;z-index:0}.dg:not(.ac) .main{overflow:hidden}.dg.main{-webkit-transition:opacity 0.1s linear;-o-transition:opacity 0.1s linear;-moz-transition:opacity 0.1s linear;transition:opacity 0.1s linear}.dg.main.taller-than-window{overflow-y:auto}.dg.main.taller-than-window .close-button{opacity:1;margin-top:-1px;border-top:1px solid #2c2c2c}.dg.main ul.closed .close-button{opacity:1 !important}.dg.main:hover .close-button,.dg.main .close-button.drag{opacity:1}.dg.main .close-button{-webkit-transition:opacity 0.1s linear;-o-transition:opacity 0.1s linear;-moz-transition:opacity 0.1s linear;transition:opacity 0.1s linear;border:0;position:absolute;line-height:19px;height:20px;cursor:pointer;text-align:center;background-color:#000}.dg.main .close-button:hover{background-color:#111}.dg.a{float:right;margin-right:15px;overflow-x:hidden}.dg.a.has-save ul{margin-top:27px}.dg.a.has-save ul.closed{margin-top:0}.dg.a .save-row{position:fixed;top:0;z-index:1002}.dg li{-webkit-transition:height 0.1s ease-out;-o-transition:height 0.1s ease-out;-moz-transition:height 0.1s ease-out;transition:height 0.1s ease-out}.dg li:not(.folder){cursor:auto;height:27px;line-height:27px;overflow:hidden;padding:0 4px 0 5px}.dg li.folder{padding:0;border-left:4px solid rgba(0,0,0,0)}.dg li.title{cursor:pointer;margin-left:-4px}.dg .closed li:not(.title),.dg .closed ul li,.dg .closed ul li > *{height:0;overflow:hidden;border:0}.dg .cr{clear:both;padding-left:3px;height:27px}.dg .property-name{cursor:default;float:left;clear:left;width:40%;overflow:hidden;text-overflow:ellipsis}.dg .c{float:left;width:60%}.dg .c input[type=text]{border:0;margin-top:4px;padding:3px;width:100%;float:right}.dg .has-slider input[type=text]{width:30%;margin-left:0}.dg .slider{float:left;width:66%;margin-left:-5px;margin-right:0;height:19px;margin-top:4px}.dg .slider-fg{height:100%}.dg .c input[type=checkbox]{margin-top:9px}.dg .c select{margin-top:5px}.dg .cr.function,.dg .cr.function .property-name,.dg .cr.function *,.dg .cr.boolean,.dg .cr.boolean *{cursor:pointer}.dg .selector{display:none;position:absolute;margin-left:-9px;margin-top:23px;z-index:10}.dg .c:hover .selector,.dg .selector.drag{display:block}.dg li.save-row{padding:0}.dg li.save-row .button{display:inline-block;padding:0px 6px}.dg.dialogue{background-color:#222;width:460px;padding:15px;font-size:13px;line-height:15px}#dg-new-constructor{padding:10px;color:#222;font-family:Monaco, monospace;font-size:10px;border:0;resize:none;box-shadow:inset 1px 1px 1px #888;word-wrap:break-word;margin:12px 0;display:block;width:440px;overflow-y:scroll;height:100px;position:relative}#dg-local-explain{display:none;font-size:11px;line-height:17px;border-radius:3px;background-color:#333;padding:8px;margin-top:10px}#dg-local-explain code{font-size:10px}#dat-gui-save-locally{display:none}.dg{color:#eee;font:11px 'Lucida Grande', sans-serif;text-shadow:0 -1px 0 #111}.dg.main::-webkit-scrollbar{width:5px;background:#1a1a1a}.dg.main::-webkit-scrollbar-corner{height:0;display:none}.dg.main::-webkit-scrollbar-thumb{border-radius:5px;background:#676767}.dg li:not(.folder){background:#1a1a1a;border-bottom:1px solid #2c2c2c}.dg li.save-row{line-height:25px;background:#dad5cb;border:0}.dg li.save-row select{margin-left:5px;width:108px}.dg li.save-row .button{margin-left:5px;margin-top:1px;border-radius:2px;font-size:9px;line-height:7px;padding:4px 4px 5px 4px;background:#c5bdad;color:#fff;text-shadow:0 1px 0 #b0a58f;box-shadow:0 -1px 0 #b0a58f;cursor:pointer}.dg li.save-row .button.gears{background:#c5bdad url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAANCAYAAAB/9ZQ7AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAQJJREFUeNpiYKAU/P//PwGIC/ApCABiBSAW+I8AClAcgKxQ4T9hoMAEUrxx2QSGN6+egDX+/vWT4e7N82AMYoPAx/evwWoYoSYbACX2s7KxCxzcsezDh3evFoDEBYTEEqycggWAzA9AuUSQQgeYPa9fPv6/YWm/Acx5IPb7ty/fw+QZblw67vDs8R0YHyQhgObx+yAJkBqmG5dPPDh1aPOGR/eugW0G4vlIoTIfyFcA+QekhhHJhPdQxbiAIguMBTQZrPD7108M6roWYDFQiIAAv6Aow/1bFwXgis+f2LUAynwoIaNcz8XNx3Dl7MEJUDGQpx9gtQ8YCueB+D26OECAAQDadt7e46D42QAAAABJRU5ErkJggg==) 2px 1px no-repeat;height:7px;width:8px}.dg li.save-row .button:hover{background-color:#bab19e;box-shadow:0 -1px 0 #b0a58f}.dg li.folder{border-bottom:0}.dg li.title{padding-left:16px;background:#000 url(data:image/gif;base64,R0lGODlhBQAFAJEAAP////Pz8////////yH5BAEAAAIALAAAAAAFAAUAAAIIlI+hKgFxoCgAOw==) 6px 10px no-repeat;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.2)}.dg .closed li.title{background-image:url(data:image/gif;base64,R0lGODlhBQAFAJEAAP////Pz8////////yH5BAEAAAIALAAAAAAFAAUAAAIIlGIWqMCbWAEAOw==)}.dg .cr.boolean{border-left:3px solid #806787}.dg .cr.function{border-left:3px solid #e61d5f}.dg .cr.number{border-left:3px solid #2fa1d6}.dg .cr.number input[type=text]{color:#2fa1d6}.dg .cr.string{border-left:3px solid #1ed36f}.dg .cr.string input[type=text]{color:#1ed36f}.dg .cr.function:hover,.dg .cr.boolean:hover{background:#111}.dg .c input[type=text]{background:#303030;outline:none}.dg .c input[type=text]:hover{background:#3c3c3c}.dg .c input[type=text]:focus{background:#494949;color:#fff}.dg .c .slider{background:#303030;cursor:ew-resize}.dg .c .slider-fg{background:#2fa1d6}.dg .c .slider:hover{background:#3c3c3c}.dg .c .slider:hover .slider-fg{background:#44abda}\n",
    dat.controllers.factory = function (e, a, c, d, f, b, n) {
        return function (h, j, m, l) {
            var o = h[j];
            if (n.isArray(m) || n.isObject(m)) return new e(h, j, m);
            if (n.isNumber(o)) return n.isNumber(m) && n.isNumber(l) ? new c(h, j, m, l) : new a(h, j, {
                min: m,
                max: l
            });
            if (n.isString(o)) return new d(h, j);
            if (n.isFunction(o)) return new f(h, j, "");
            if (n.isBoolean(o)) return new b(h, j)
        }
    }(dat.controllers.OptionController, dat.controllers.NumberControllerBox, dat.controllers.NumberControllerSlider, dat.controllers.StringController = function (e, a, c) {
        var d =
            function (c, b) {
                function e() {
                    h.setValue(h.__input.value)
                }
                d.superclass.call(this, c, b);
                var h = this;
                this.__input = document.createElement("input");
                this.__input.setAttribute("type", "text");
                a.bind(this.__input, "keyup", e);
                a.bind(this.__input, "change", e);
                a.bind(this.__input, "blur", function () {
                    h.__onFinishChange && h.__onFinishChange.call(h, h.getValue())
                });
                a.bind(this.__input, "keydown", function (a) {
                    a.keyCode === 13 && this.blur()
                });
                this.updateDisplay();
                this.domElement.appendChild(this.__input)
            };
        d.superclass = e;
        c.extend(d.prototype,
            e.prototype, {
                updateDisplay: function () {
                    if (!a.isActive(this.__input)) this.__input.value = this.getValue();
                    return d.superclass.prototype.updateDisplay.call(this)
                }
            });
        return d
    }(dat.controllers.Controller, dat.dom.dom, dat.utils.common), dat.controllers.FunctionController, dat.controllers.BooleanController, dat.utils.common), dat.controllers.Controller, dat.controllers.BooleanController, dat.controllers.FunctionController, dat.controllers.NumberControllerBox, dat.controllers.NumberControllerSlider, dat.controllers.OptionController,
    dat.controllers.ColorController = function (e, a, c, d, f) {
        function b(a, b, c, d) {
            a.style.background = "";
            f.each(j, function (e) {
                a.style.cssText += "background: " + e + "linear-gradient(" + b + ", " + c + " 0%, " + d + " 100%); "
            })
        }

        function n(a) {
            a.style.background = "";
            a.style.cssText += "background: -moz-linear-gradient(top,  #ff0000 0%, #ff00ff 17%, #0000ff 34%, #00ffff 50%, #00ff00 67%, #ffff00 84%, #ff0000 100%);";
            a.style.cssText += "background: -webkit-linear-gradient(top,  #ff0000 0%,#ff00ff 17%,#0000ff 34%,#00ffff 50%,#00ff00 67%,#ffff00 84%,#ff0000 100%);";
            a.style.cssText += "background: -o-linear-gradient(top,  #ff0000 0%,#ff00ff 17%,#0000ff 34%,#00ffff 50%,#00ff00 67%,#ffff00 84%,#ff0000 100%);";
            a.style.cssText += "background: -ms-linear-gradient(top,  #ff0000 0%,#ff00ff 17%,#0000ff 34%,#00ffff 50%,#00ff00 67%,#ffff00 84%,#ff0000 100%);";
            a.style.cssText += "background: linear-gradient(top,  #ff0000 0%,#ff00ff 17%,#0000ff 34%,#00ffff 50%,#00ff00 67%,#ffff00 84%,#ff0000 100%);"
        }
        var h = function (e, l) {
            function o(b) {
                q(b);
                a.bind(window, "mousemove", q);
                a.bind(window,
                    "mouseup", j)
            }

            function j() {
                a.unbind(window, "mousemove", q);
                a.unbind(window, "mouseup", j)
            }

            function g() {
                var a = d(this.value);
                a !== false ? (p.__color.__state = a, p.setValue(p.__color.toOriginal())) : this.value = p.__color.toString()
            }

            function i() {
                a.unbind(window, "mousemove", s);
                a.unbind(window, "mouseup", i)
            }

            function q(b) {
                b.preventDefault();
                var c = a.getWidth(p.__saturation_field),
                    d = a.getOffset(p.__saturation_field),
                    e = (b.clientX - d.left + document.body.scrollLeft) / c,
                    b = 1 - (b.clientY - d.top + document.body.scrollTop) / c;
                b > 1 ? b =
                    1 : b < 0 && (b = 0);
                e > 1 ? e = 1 : e < 0 && (e = 0);
                p.__color.v = b;
                p.__color.s = e;
                p.setValue(p.__color.toOriginal());
                return false
            }

            function s(b) {
                b.preventDefault();
                var c = a.getHeight(p.__hue_field),
                    d = a.getOffset(p.__hue_field),
                    b = 1 - (b.clientY - d.top + document.body.scrollTop) / c;
                b > 1 ? b = 1 : b < 0 && (b = 0);
                p.__color.h = b * 360;
                p.setValue(p.__color.toOriginal());
                return false
            }
            h.superclass.call(this, e, l);
            this.__color = new c(this.getValue());
            this.__temp = new c(0);
            var p = this;
            this.domElement = document.createElement("div");
            a.makeSelectable(this.domElement,
                false);
            this.__selector = document.createElement("div");
            this.__selector.className = "selector";
            this.__saturation_field = document.createElement("div");
            this.__saturation_field.className = "saturation-field";
            this.__field_knob = document.createElement("div");
            this.__field_knob.className = "field-knob";
            this.__field_knob_border = "2px solid ";
            this.__hue_knob = document.createElement("div");
            this.__hue_knob.className = "hue-knob";
            this.__hue_field = document.createElement("div");
            this.__hue_field.className = "hue-field";
            this.__input =
                document.createElement("input");
            this.__input.type = "text";
            this.__input_textShadow = "0 1px 1px ";
            a.bind(this.__input, "keydown", function (a) {
                a.keyCode === 13 && g.call(this)
            });
            a.bind(this.__input, "blur", g);
            a.bind(this.__selector, "mousedown", function () {
                a.addClass(this, "drag").bind(window, "mouseup", function () {
                    a.removeClass(p.__selector, "drag")
                })
            });
            var t = document.createElement("div");
            f.extend(this.__selector.style, {
                width: "122px",
                height: "102px",
                padding: "3px",
                backgroundColor: "#222",
                boxShadow: "0px 1px 3px rgba(0,0,0,0.3)"
            });
            f.extend(this.__field_knob.style, {
                position: "absolute",
                width: "12px",
                height: "12px",
                border: this.__field_knob_border + (this.__color.v < 0.5 ? "#fff" : "#000"),
                boxShadow: "0px 1px 3px rgba(0,0,0,0.5)",
                borderRadius: "12px",
                zIndex: 1
            });
            f.extend(this.__hue_knob.style, {
                position: "absolute",
                width: "15px",
                height: "2px",
                borderRight: "4px solid #fff",
                zIndex: 1
            });
            f.extend(this.__saturation_field.style, {
                width: "100px",
                height: "100px",
                border: "1px solid #555",
                marginRight: "3px",
                display: "inline-block",
                cursor: "pointer"
            });
            f.extend(t.style, {
                width: "100%",
                height: "100%",
                background: "none"
            });
            b(t, "top", "rgba(0,0,0,0)", "#000");
            f.extend(this.__hue_field.style, {
                width: "15px",
                height: "100px",
                display: "inline-block",
                border: "1px solid #555",
                cursor: "ns-resize"
            });
            n(this.__hue_field);
            f.extend(this.__input.style, {
                outline: "none",
                textAlign: "center",
                color: "#fff",
                border: 0,
                fontWeight: "bold",
                textShadow: this.__input_textShadow + "rgba(0,0,0,0.7)"
            });
            a.bind(this.__saturation_field, "mousedown", o);
            a.bind(this.__field_knob, "mousedown", o);
            a.bind(this.__hue_field, "mousedown",
                function (b) {
                    s(b);
                    a.bind(window, "mousemove", s);
                    a.bind(window, "mouseup", i)
                });
            this.__saturation_field.appendChild(t);
            this.__selector.appendChild(this.__field_knob);
            this.__selector.appendChild(this.__saturation_field);
            this.__selector.appendChild(this.__hue_field);
            this.__hue_field.appendChild(this.__hue_knob);
            this.domElement.appendChild(this.__input);
            this.domElement.appendChild(this.__selector);
            this.updateDisplay()
        };
        h.superclass = e;
        f.extend(h.prototype, e.prototype, {
            updateDisplay: function () {
                var a = d(this.getValue());
                if (a !== false) {
                    var e = false;
                    f.each(c.COMPONENTS, function (b) {
                        if (!f.isUndefined(a[b]) && !f.isUndefined(this.__color.__state[b]) && a[b] !== this.__color.__state[b]) return e = true, {}
                    }, this);
                    e && f.extend(this.__color.__state, a)
                }
                f.extend(this.__temp.__state, this.__color.__state);
                this.__temp.a = 1;
                var h = this.__color.v < 0.5 || this.__color.s > 0.5 ? 255 : 0,
                    j = 255 - h;
                f.extend(this.__field_knob.style, {
                    marginLeft: 100 * this.__color.s - 7 + "px",
                    marginTop: 100 * (1 - this.__color.v) - 7 + "px",
                    backgroundColor: this.__temp.toString(),
                    border: this.__field_knob_border +
                        "rgb(" + h + "," + h + "," + h + ")"
                });
                this.__hue_knob.style.marginTop = (1 - this.__color.h / 360) * 100 + "px";
                this.__temp.s = 1;
                this.__temp.v = 1;
                b(this.__saturation_field, "left", "#fff", this.__temp.toString());
                f.extend(this.__input.style, {
                    backgroundColor: this.__input.value = this.__color.toString(),
                    color: "rgb(" + h + "," + h + "," + h + ")",
                    textShadow: this.__input_textShadow + "rgba(" + j + "," + j + "," + j + ",.7)"
                })
            }
        });
        var j = ["-moz-", "-o-", "-webkit-", "-ms-", ""];
        return h
    }(dat.controllers.Controller, dat.dom.dom, dat.color.Color = function (e, a, c, d) {
        function f(a,
            b, c) {
            Object.defineProperty(a, b, {
                get: function () {
                    if (this.__state.space === "RGB") return this.__state[b];
                    n(this, b, c);
                    return this.__state[b]
                },
                set: function (a) {
                    if (this.__state.space !== "RGB") n(this, b, c), this.__state.space = "RGB";
                    this.__state[b] = a
                }
            })
        }

        function b(a, b) {
            Object.defineProperty(a, b, {
                get: function () {
                    if (this.__state.space === "HSV") return this.__state[b];
                    h(this);
                    return this.__state[b]
                },
                set: function (a) {
                    if (this.__state.space !== "HSV") h(this), this.__state.space = "HSV";
                    this.__state[b] = a
                }
            })
        }

        function n(b, c, e) {
            if (b.__state.space ===
                "HEX") b.__state[c] = a.component_from_hex(b.__state.hex, e);
            else if (b.__state.space === "HSV") d.extend(b.__state, a.hsv_to_rgb(b.__state.h, b.__state.s, b.__state.v));
            else throw "Corrupted color state";
        }

        function h(b) {
            var c = a.rgb_to_hsv(b.r, b.g, b.b);
            d.extend(b.__state, {
                s: c.s,
                v: c.v
            });
            if (d.isNaN(c.h)) {
                if (d.isUndefined(b.__state.h)) b.__state.h = 0
            } else b.__state.h = c.h
        }
        var j = function () {
            this.__state = e.apply(this, arguments);
            if (this.__state === false) throw "Failed to interpret color arguments";
            this.__state.a = this.__state.a ||
                1
        };
        j.COMPONENTS = "r,g,b,h,s,v,hex,a".split(",");
        d.extend(j.prototype, {
            toString: function () {
                return c(this)
            },
            toOriginal: function () {
                return this.__state.conversion.write(this)
            }
        });
        f(j.prototype, "r", 2);
        f(j.prototype, "g", 1);
        f(j.prototype, "b", 0);
        b(j.prototype, "h");
        b(j.prototype, "s");
        b(j.prototype, "v");
        Object.defineProperty(j.prototype, "a", {
            get: function () {
                return this.__state.a
            },
            set: function (a) {
                this.__state.a = a
            }
        });
        Object.defineProperty(j.prototype, "hex", {
            get: function () {
                if (!this.__state.space !== "HEX") this.__state.hex =
                    a.rgb_to_hex(this.r, this.g, this.b);
                return this.__state.hex
            },
            set: function (a) {
                this.__state.space = "HEX";
                this.__state.hex = a
            }
        });
        return j
    }(dat.color.interpret, dat.color.math = function () {
        var e;
        return {
            hsv_to_rgb: function (a, c, d) {
                var e = a / 60 - Math.floor(a / 60),
                    b = d * (1 - c),
                    n = d * (1 - e * c),
                    c = d * (1 - (1 - e) * c),
                    a = [
                        [d, c, b],
                        [n, d, b],
                        [b, d, c],
                        [b, n, d],
                        [c, b, d],
                        [d, b, n]
                    ][Math.floor(a / 60) % 6];
                return {
                    r: a[0] * 255,
                    g: a[1] * 255,
                    b: a[2] * 255
                }
            },
            rgb_to_hsv: function (a, c, d) {
                var e = Math.min(a, c, d),
                    b = Math.max(a, c, d),
                    e = b - e;
                if (b == 0) return {
                    h: NaN,
                    s: 0,
                    v: 0
                };
                a = a == b ? (c - d) / e : c == b ? 2 + (d - a) / e : 4 + (a - c) / e;
                a /= 6;
                a < 0 && (a += 1);
                return {
                    h: a * 360,
                    s: e / b,
                    v: b / 255
                }
            },
            rgb_to_hex: function (a, c, d) {
                a = this.hex_with_component(0, 2, a);
                a = this.hex_with_component(a, 1, c);
                return a = this.hex_with_component(a, 0, d)
            },
            component_from_hex: function (a, c) {
                return a >> c * 8 & 255
            },
            hex_with_component: function (a, c, d) {
                return d << (e = c * 8) | a & ~(255 << e)
            }
        }
    }(), dat.color.toString, dat.utils.common), dat.color.interpret, dat.utils.common), dat.utils.requestAnimationFrame = function () {
        return window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame || function (e) {
                window.setTimeout(e, 1E3 / 60)
            }
    }(), dat.dom.CenteredDiv = function (e, a) {
        var c = function () {
            this.backgroundElement = document.createElement("div");
            a.extend(this.backgroundElement.style, {
                backgroundColor: "rgba(0,0,0,0.8)",
                top: 0,
                left: 0,
                display: "none",
                zIndex: "1000",
                opacity: 0,
                WebkitTransition: "opacity 0.2s linear"
            });
            e.makeFullscreen(this.backgroundElement);
            this.backgroundElement.style.position = "fixed";
            this.domElement =
                document.createElement("div");
            a.extend(this.domElement.style, {
                position: "fixed",
                display: "none",
                zIndex: "1001",
                opacity: 0,
                WebkitTransition: "-webkit-transform 0.2s ease-out, opacity 0.2s linear"
            });
            document.body.appendChild(this.backgroundElement);
            document.body.appendChild(this.domElement);
            var c = this;
            e.bind(this.backgroundElement, "click", function () {
                c.hide()
            })
        };
        c.prototype.show = function () {
            var c = this;
            this.backgroundElement.style.display = "block";
            this.domElement.style.display = "block";
            this.domElement.style.opacity =
                0;
            this.domElement.style.webkitTransform = "scale(1.1)";
            this.layout();
            a.defer(function () {
                c.backgroundElement.style.opacity = 1;
                c.domElement.style.opacity = 1;
                c.domElement.style.webkitTransform = "scale(1)"
            })
        };
        c.prototype.hide = function () {
            var a = this,
                c = function () {
                    a.domElement.style.display = "none";
                    a.backgroundElement.style.display = "none";
                    e.unbind(a.domElement, "webkitTransitionEnd", c);
                    e.unbind(a.domElement, "transitionend", c);
                    e.unbind(a.domElement, "oTransitionEnd", c)
                };
            e.bind(this.domElement, "webkitTransitionEnd",
                c);
            e.bind(this.domElement, "transitionend", c);
            e.bind(this.domElement, "oTransitionEnd", c);
            this.backgroundElement.style.opacity = 0;
            this.domElement.style.opacity = 0;
            this.domElement.style.webkitTransform = "scale(1.1)"
        };
        c.prototype.layout = function () {
            this.domElement.style.left = window.innerWidth / 2 - e.getWidth(this.domElement) / 2 + "px";
            this.domElement.style.top = window.innerHeight / 2 - e.getHeight(this.domElement) / 2 + "px"
        };
        return c
    }(dat.dom.dom, dat.utils.common), dat.dom.dom, dat.utils.common);
// #endregion

//------------------------------
// Mesh Properties
//------------------------------

var MESH = {
    width: 1.2,
    height: 1.2,
    slices: 250,
    ambient: '#3300FF',
    diffuse: '#FFFFFF',
    borderColor: '#000000',
    borderOpacity: 1.00
};

//------------------------------
// Light Properties
//------------------------------
var LIGHT = {
    count: 1,
    xPos: 0,
    yPos: 0,
    zOffset: 0,
    ambient: '#999999',
    diffuse: '#33CCFF',
    object: null
};

var MOUSE = {
    detect: true,
    x: null,
    y: null
}

//------------------------------
// Render Properties
//------------------------------
var WEBGL = 'webgl';
var CANVAS = 'canvas';
var SVG = 'svg';
var RENDER = {
    renderer: CANVAS,
    movementFrames: 100,
    movementDistance: 50,
    movementRandomness: 1
};

//------------------------------
// Export Properties
//------------------------------
var EXPORT = {
    width: 2000,
    height: 1000,

    exportCurrent: function () {
        switch (RENDER.renderer) {
            case WEBGL:
                window.open(webglRenderer.element.toDataURL(), '_blank');
                break;
            case CANVAS:
                window.open(canvasRenderer.element.toDataURL(), '_blank');
                break;
            case SVG:
                var data = encodeURIComponent(output.innerHTML);
                var url = "data:image/svg+xml," + data;
                window.open(url, '_blank');
                break;
        }
    },
    export: function () {
        var x, y, light,
            scalarX = this.width / renderer.width,
            scalarY = this.height / renderer.height;

        // store a temp value of the slices
        var slices = MESH.slices;
        // Increase or decrease number of slices depending on the size of the canvas
        MESH.slices = Math.ceil(slices * scalarX * 1.3);

        // Regenerate the whole canvas
        resize(this.width, this.height);

        // restore the number of slices
        MESH.slices = slices;

        // Move the light on the plane to accomodate the size of the canvas
        light = scene.light;
        x = light.position[0];
        y = light.position[1];
        z = light.position[2];
        Vector3.set(light.position, x * scalarX, y * scalarY, z * scalarX);

        // Render the canvas
        render();

        switch (RENDER.renderer) {
            case WEBGL:
                window.open(webglRenderer.element.toDataURL(), '_blank');
                break;
            case CANVAS:
                window.open(canvasRenderer.element.toDataURL(), '_blank');
                break;
            case SVG:
                var data = encodeURIComponent(output.innerHTML);
                var url = "data:image/svg+xml," + data;
                window.open(url, '_blank');
                break;
        }

        resize(container.offsetWidth, container.offsetHeight);

        light = scene.light;
        y = light.position[1];
        z = light.position[2];
        Vector3.set(light.position, 0, y / scalarY, z / scalarX);
    }
};

//------------------------------
// Global Properties
//------------------------------
var center = Vector3.create();
var container = document.getElementById('container');
var output = document.getElementById('output');
var renderer, scene, mesh, geometry, material, light;
var webglRenderer, canvasRenderer, svgRenderer;

//------------------------------
// Methods
//------------------------------
function main() {
    createRenderer()
    createScene()
    createMesh()
    createLight()

    addEventListeners()
    resize(container.offsetWidth, container.offsetHeight)

    animate()
}

function createRenderer() {
    webglRenderer = new WebGLRenderer();
    canvasRenderer = new CanvasRenderer();
    svgRenderer = new SVGRenderer();
    setRenderer(RENDER.renderer);
}

function setRenderer(index) {
    if (renderer) {
        output.removeChild(renderer.element);
    }
    switch (index) {
        case WEBGL:
            renderer = webglRenderer;
            break;
        case CANVAS:
            renderer = canvasRenderer;
            break;
        case SVG:
            renderer = svgRenderer;
            break;
    }
    renderer.setSize(container.offsetWidth, container.offsetHeight);
    output.appendChild(renderer.element);
}

function createScene() {
    scene = new Scene();
}

function createMesh() {
    scene.remove(mesh);
    renderer.clear();

    geometry = new Plane(MESH.width * renderer.width, MESH.height * renderer.height, MESH.slices);
    material = new Material(MESH.ambient, MESH.diffuse);
    mesh = new Mesh(geometry, material);

    scene.add(mesh);
}

function createLight(width, height) {
    renderer.clear();

    light = new Light(LIGHT.ambient, LIGHT.diffuse);
    LIGHT.object = light;

    light.ambientHex = light.ambient.format();
    light.diffuseHex = light.diffuse.format();
    updateLightPosition(width, height);

    scene.add(light);
}

function updateLightPosition(width, height) {
    LIGHT.xPos = 0;
    LIGHT.yPos = -height / 2;
    LIGHT.zOffset = height / 4;

    LIGHT.object.setPosition(LIGHT.xPos, LIGHT.yPos, LIGHT.zOffset);
}

function render() {
    scene.remove(mesh);
    renderer.clear();

    geometry.movementFrame(renderer.halfWidth, renderer.halfHeight, MESH.slices);
    mesh.setGeometry(geometry);

    scene.add(mesh);
    renderer.render(scene);
}

function addEventListeners() {
    window.addEventListener('resize', onWindowResize)
    container.addEventListener('mousemove', onMouseMove)
}

function animate() {
    render();
    requestAnimationFrame(animate);
}

// Resize canvas
function resize(width, height) {
    renderer.setSize(width, height);
    Vector3.set(center, renderer.halfWidth, renderer.halfHeight);
    createMesh();

    updateLightPosition(width, height);
}

//------------------------------
// Callbacks
//------------------------------

function onWindowResize(event) {
    resize(container.offsetWidth, container.offsetHeight)
    render()
}

function onMouseMove(event) {
    if (MOUSE.detect) {
        MOUSE.x = event.x
        MOUSE.y = event.y
    }
}

main()

// lively fns
function livelyPropertyListener(name, val) {
    switch (name) {
        case "meshAmbient":
            MESH.ambient = val;
            for (i = 0, l = scene.meshes.length; i < l; i++) {
                scene.meshes[i].material.ambient.set(val);
            }
            break;
        case "meshDiffuse":
            MESH.diffuse = val;
            for (i = 0, l = scene.meshes.length; i < l; i++) {
                scene.meshes[i].material.diffuse.set(val);
            }
            break;
        case "meshSlices":
            MESH.slices = val;
            if (geometry.slices !== val) {
                createMesh();
            }
            break;
        case "lightAmbient":
            LIGHT.object.ambient.set(val);
            LIGHT.object.ambientHex = LIGHT.object.ambient.format();
            break;
        case "lightDiffuse":
            LIGHT.object.diffuse.set(val);
            LIGHT.object.diffuseHex = LIGHT.object.ambient.format();
            break;
        case "lightDistance":
            LIGHT.zOffset = val;
            LIGHT.object.setPosition(LIGHT.object.position[0], LIGHT.object.position[1], val);
            break;
        case "movementSpeed":
            RENDER.movementFrames = 301 - val;
            break;
        case "movementDistance":
            RENDER.movementDistance = val;
            break;
        case "movementRandomness":
            RENDER.movementRandomness = 1 - (val / 100);
            break;
        case "borderColor":
            MESH.borderColor = val;
            break;
        case "borderOpacity":
            MESH.borderOpacity = val / 100;
            break;
        case "detectMouse":
            MOUSE.detect = val;
            break;
    }
}