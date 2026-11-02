// GRAVEHUSH — random level generator (house, hospital, school, farm) for both eras
'use strict';

GH.LOCATIONS = ['house', 'hospital', 'school', 'farm'];
GH.LOCS = { modern: ['house', 'hospital', 'school', 'farm'], medieval: ['house', 'hospital', 'school', 'farm', 'castle', 'catacombs', 'church'] };

const THEMES = {
  modern: {
    house: { ext: 3, door: 20, front: 20, rooms: { kitchen: [2, 31, 40], living: [1, 30, 40], bedroom: [1, 32, 40], nursery: [1, 32, 40], bathroom: [4, 31, 42], study: [7, 30, 40], hall: [2, 30, 40], storage: [8, 33, 40] } },
    hospital: { ext: 8, door: 21, front: 21, rooms: { ward: [4, 33, 42], operating: [4, 31, 42], morgue: [4, 33, 42], office: [2, 33, 42], cell: [2, 33, 42], bathroom: [4, 31, 42], storage: [8, 33, 42], hall: [4, 33, 42] } },
    school: { ext: 3, door: 20, front: 20, rooms: { classroom: [5, 30, 42], gym: [5, 30, 42], cafeteria: [5, 33, 42], library: [7, 30, 40], restroom: [4, 31, 42], office: [2, 32, 40], music: [7, 30, 40], hall: [5, 33, 42] } },
    farm: { ext: 6, door: 20, front: 20, rooms: { kitchen: [2, 31, 40], bedroom: [1, 30, 40], living: [1, 30, 40], storage: [8, 33, 40], hall: [2, 30, 40], barn: [6, 35, 41], shed: [6, 37, 41], bathroom: [4, 31, 42] } }
  },
  medieval: {
    house: { ext: 14, door: 22, front: 22, rooms: { kitchen: [9, 34, 41], living: [10, 34, 41], bedroom: [10, 35, 41], nursery: [10, 35, 41], bathroom: [9, 34, 43], study: [7, 34, 41], hall: [9, 34, 43], storage: [11, 35, 43] } },
    hospital: { ext: 14, door: 22, front: 22, rooms: { ward: [13, 34, 43], operating: [9, 34, 43], morgue: [11, 34, 43], office: [13, 34, 41], cell: [11, 35, 43], bathroom: [9, 34, 43], storage: [11, 35, 43], hall: [9, 34, 43] } },
    school: { ext: 14, door: 22, front: 22, rooms: { classroom: [13, 34, 41], gym: [9, 34, 41], cafeteria: [13, 34, 41], library: [7, 34, 41], restroom: [11, 35, 43], office: [13, 34, 41], music: [9, 34, 43], hall: [9, 34, 43] } },
    farm: { ext: 10, door: 22, front: 22, rooms: { kitchen: [10, 34, 41], bedroom: [10, 35, 41], living: [10, 34, 41], storage: [11, 35, 43], hall: [10, 34, 41], barn: [12, 35, 41], shed: [12, 37, 41], bathroom: [9, 34, 43] } },
    castle: { ext: 14, door: 22, front: 23, rooms: { greathall: [9, 34, 41], throne: [9, 34, 41], armory: [9, 34, 43], barracks: [9, 35, 43], dungeon: [11, 35, 43], chapel: [13, 34, 43], tower: [9, 34, 43], bedchamber: [10, 34, 41], kitchen: [9, 34, 41], storage: [11, 35, 43], hall: [9, 34, 43] } },
    catacombs: { ext: 11, door: 22, front: 22, rooms: { ossuary: [18, 34, 43], tomb: [11, 34, 43], crypt: [18, 34, 43], shrine: [13, 34, 43], hall: [18, 35, 43] } },
    church: { ext: 14, door: 22, front: 22, rooms: { nave: [13, 34, 41], apse: [13, 34, 41], chapel: [13, 34, 43], sacristy: [10, 34, 41], belltower: [9, 34, 43], hut: [12, 37, 41], tomb: [11, 34, 43], hall: [13, 34, 41] } }
  }
};

// furniture: [sprite, min, max]
const FURN = {
  kitchen: [['table', 1, 1], ['chair', 1, 2], ['shelf', 0, 1], ['barrel', 0, 1]],
  living: [['table', 1, 1], ['chair', 1, 3], ['shelf', 1, 2], ['piano', 0, 1], ['wardrobe', 0, 1]],
  bedroom: [['bed', 1, 1], ['wardrobe', 1, 1], ['chair', 0, 1], ['shelf', 0, 1]],
  nursery: [['crib', 1, 1], ['wardrobe', 1, 1], ['chair', 0, 1]],
  bathroom: [['bathtub', 1, 1], ['toilet', 0, 1]],
  study: [['desk', 1, 1], ['shelf', 1, 2], ['chair', 1, 1], ['wardrobe', 0, 1]],
  storage: [['crate', 1, 3], ['barrel', 0, 2], ['wardrobe', 0, 1]],
  ward: [['hospbed', 2, 4], ['locker', 1, 1], ['gurney', 0, 1]],
  operating: [['gurney', 1, 1], ['table', 1, 1], ['shelf', 0, 1]],
  morgue: [['morgue', 1, 2], ['gurney', 1, 1]],
  office: [['desk', 1, 1], ['shelf', 1, 1], ['chair', 1, 1], ['locker', 0, 1]],
  cell: [['bed', 1, 1]],
  classroom: [['desk', 3, 6], ['chair', 0, 2], ['shelf', 0, 1], ['locker', 0, 1]],
  gym: [['crate', 1, 2], ['locker', 1, 2]],
  cafeteria: [['table', 2, 4], ['chair', 2, 4]],
  library: [['shelf', 3, 6], ['desk', 1, 1]],
  restroom: [['toilet', 1, 2]],
  music: [['piano', 1, 1], ['chair', 1, 3], ['wardrobe', 0, 1]],
  barn: [['hay', 2, 4], ['barrel', 1, 2], ['crate', 1, 2]],
  shed: [['crate', 1, 2], ['barrel', 0, 1], ['wardrobe', 0, 1]],
  greathall: [['table', 2, 3], ['chair', 2, 4], ['armor', 0, 2]],
  throne: [['throne', 1, 1], ['armor', 1, 2], ['chest', 0, 1]],
  armory: [['armor', 2, 3], ['barrel', 1, 1], ['crate', 1, 2]],
  barracks: [['bed', 2, 4], ['chest', 1, 1], ['barrel', 0, 1], ['wardrobe', 0, 1]],
  dungeon: [['bonepile', 1, 1], ['hay', 0, 1], ['barrel', 0, 1]],
  chapel: [['pew', 2, 3], ['altar', 1, 1]],
  tower: [['crate', 1, 1], ['barrel', 0, 1], ['chest', 0, 1]],
  bedchamber: [['bed', 1, 1], ['wardrobe', 1, 1], ['chair', 0, 1], ['chest', 0, 1]],
  ossuary: [['bonepile', 2, 4], ['sarcophagus', 0, 1]],
  tomb: [['sarcophagus', 1, 2], ['coffin', 0, 1]],
  crypt: [['coffin', 1, 2], ['sarcophagus', 1, 1]],
  shrine: [['altar', 1, 1], ['bonepile', 0, 1], ['coffin', 0, 1]],
  apse: [['altar', 1, 1]],
  sacristy: [['wardrobe', 1, 1], ['chest', 1, 1], ['shelf', 0, 1]],
  belltower: [['crate', 1, 1], ['barrel', 0, 1]],
  hut: [['bed', 1, 1], ['table', 1, 1], ['wardrobe', 0, 1], ['barrel', 0, 1]],
  nave: [],
  hall: []
};
const MED_SWAP = { toilet: 'barrel', hospbed: 'bed', locker: 'wardrobe', gurney: 'table', morgue: 'chest', piano: 'shelf' };
const SPR_H = { sarcophagus: 0.62, coffin: 0.62, pew: 0.62, altar: 0.7, throne: 1.0, armor: 1.0, bonepile: 0.45, bed: 0.62, hospbed: 0.62, wardrobe: 1.0, locker: 1.0, table: 0.62, desk: 0.62, chair: 0.62, shelf: 1.0, bathtub: 0.62, toilet: 0.62, crib: 0.62, piano: 0.66, gurney: 0.62, morgue: 1.0, hay: 0.66, barrel: 0.62, crate: 0.62, chest: 0.62, van: 0.9, cart: 0.9, tree: 1.6, deadtree: 1.6, grave: 0.6, well: 0.7, equip: 0.55 };
const HIDE = { wardrobe: 1, locker: 1, hay: 1, sarcophagus: 1, coffin: 1 };
const LOC_ROOMS = {
  house: ['living', 'kitchen', 'bedroom', 'bedroom', 'study', 'bathroom', 'nursery', 'storage', 'bedroom', 'study', 'storage'],
  hospital: ['ward', 'ward', 'operating', 'morgue', 'office', 'cell', 'bathroom', 'storage', 'ward', 'cell', 'office', 'cell', 'storage', 'ward', 'cell', 'bathroom'],
  school: ['gym', 'cafeteria', 'classroom', 'classroom', 'library', 'classroom', 'office', 'restroom', 'music', 'classroom', 'restroom', 'office', 'classroom', 'storage'],
  farmhouse: ['living', 'kitchen', 'bedroom', 'storage', 'bedroom', 'bathroom'],
  castle: ['greathall', 'throne', 'kitchen', 'armory', 'barracks', 'bedchamber', 'chapel', 'dungeon', 'dungeon', 'storage', 'bedchamber', 'dungeon', 'storage', 'barracks', 'dungeon']
};

GH.genMap = function (seed, era, loc) {
  const r = GH.rng(seed);
  const theme = THEMES[era][loc];
  const S = { house: [30, 28], hospital: [46, 38], school: [44, 36], farm: [46, 42], castle: [54, 46], catacombs: [46, 42], church: [48, 44] }[loc];
  const w = S[0], h = S[1];
  const N = w * h;
  const map = {
    w, h, era, loc, seed,
    cells: new Uint8Array(N), doorAt: new Int16Array(N).fill(-1), floor: new Uint8Array(N), ceil: new Uint8Array(N),
    roomId: new Int16Array(N).fill(-1), outdoor: new Uint8Array(N), blockObj: new Int16Array(N).fill(-1),
    doors: [], rooms: [], objects: [], lights: []
  };
  const I = (x, y) => y * w + x;
  // ---- outdoors ----
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = I(x, y);
    const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
    map.cells[i] = edge ? (loc === 'castle' ? 14 : r.chance(0.7) ? 15 : 16) : 0;
    map.floor[i] = loc === 'castle' ? 38 : 36; map.ceil[i] = 0; map.outdoor[i] = 1;
  }
  const outRoom = { id: 0, type: 'yard', cells: [], outdoor: true };
  map.rooms.push(outRoom);

  function addRoom(type, x, y, rw, rh, wallTex, freeOnly) {
    const t = theme.rooms[type] || theme.rooms.hall;
    const room = { id: map.rooms.length, type, x, y, w: rw, h: rh, cx: x + rw / 2, cy: y + rh / 2, cells: [] };
    for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) {
      const i = I(xx, yy); if (map.cells[i] !== 0 || (freeOnly && map.roomId[i] > 0) || map.doorAt[i] >= 0) continue;
      map.roomId[i] = room.id; map.floor[i] = t[1]; map.ceil[i] = t[2]; map.outdoor[i] = 0; room.cells.push(i);
    }
    room.wallTex = wallTex !== undefined ? wallTex : t[0];
    map.rooms.push(room);
    return room;
  }
  function addDoor(x, y, tex, front) {
    const i = I(x, y);
    const wl = x > 0 && map.cells[I(x - 1, y)] > 0, wr = x < w - 1 && map.cells[I(x + 1, y)] > 0;
    map.cells[i] = 0;
    const d = { i: map.doors.length, x, y, axis: (wl && wr) ? 'h' : 'v', open: 0, target: 0, locked: 0, tex, front: !!front };
    map.doorAt[i] = d.i; map.doors.push(d);
    map.floor[i] = map.floor[i] || 30; map.ceil[i] = map.ceil[i] || 40; map.outdoor[i] = 0;
    return d;
  }

  // ---- BSP building ----
  // Builds a walled building in rect (bx,by,bw,bh); returns list of rooms
  map.buildings = [];
  function building(bx, by, bw, bh, extTex, roomTypes, corridor, maxRoom, kind) {
    map.buildings.push({ x: bx, y: by, w: bw, h: bh, ext: extTex, kind: kind || 'house' });
    for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) { map.cells[I(x, y)] = extTex; map.outdoor[I(x, y)] = 0; map.ceil[I(x, y)] = 40; }
    const ix = bx + 1, iy = by + 1, iw = bw - 2, ih = bh - 2;
    for (let y = iy; y < iy + ih; y++) for (let x = ix; x < ix + iw; x++) map.cells[I(x, y)] = 0;
    const splits = [], leaves = [];
    const blocks = [];
    let corridorRooms = [];
    const intWall = theme.rooms.hall[0];
    if (corridor) {
      // horizontal 2-wide spine + 1 or 2 vertical spines
      const cy = iy + Math.floor(ih / 2) - 1 + r.int(-2, 2);
      for (let x = ix; x < ix + iw; x++) { map.cells[I(x, cy - 1)] = intWall; map.cells[I(x, cy + 2)] = intWall; }
      const vcols = [];
      const nv = iw > 34 ? 2 : 1;
      for (let k = 0; k < nv; k++) vcols.push(ix + Math.floor(iw * (k + 1) / (nv + 1)) - 1 + r.int(-2, 2));
      for (const cx of vcols) for (let y = iy; y < iy + ih; y++) { map.cells[I(cx - 1, y)] = intWall; map.cells[I(cx + 2, y)] = intWall; }
      // carve corridor cells
      for (let x = ix; x < ix + iw; x++) for (const yy of [cy, cy + 1]) map.cells[I(x, yy)] = 0;
      for (const cx of vcols) for (let y = iy; y < iy + ih; y++) for (const xx of [cx, cx + 1]) map.cells[I(xx, y)] = 0;
      const hall = addRoom('hall', ix, iy, iw, ih); // claims only corridor cells (others are walls/unclaimed later)
      corridorRooms.push(hall);
      // blocks: between spines
      const xs = [ix - 1, ...vcols.flatMap(c => [c - 1, c + 2]), ix + iw];
      const ys = [iy - 1, cy - 1, cy + 2, iy + ih];
      for (let yb = 0; yb < ys.length - 1; yb += 2) for (let xb = 0; xb < xs.length - 1; xb += 2) {
        const x0 = xs[xb] + 1, x1 = xs[xb + 1] - 1, y0 = ys[yb] + 1, y1 = ys[yb + 1] - 1;
        if (x1 - x0 >= 2 && y1 - y0 >= 2) blocks.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
      }
      // un-claim block cells from hall (addRoom claimed all floor cells at that time)
      for (const b of blocks) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) map.roomId[I(x, y)] = -1;
      hall.cells = hall.cells.filter(i => map.roomId[i] === hall.id);
    } else blocks.push({ x: ix, y: iy, w: iw, h: ih });

    const maxW = maxRoom, minS = 3;
    function bsp(n, depth) {
      const big = n.w > maxW || n.h > maxW || (n.w * n.h > maxW * maxW * 0.6 && r.chance(0.6));
      if (!big || (n.w < minS * 2 + 1 && n.h < minS * 2 + 1)) { leaves.push(n); return; }
      let vert = n.w > n.h * 1.2 ? true : n.h > n.w * 1.2 ? false : r.chance(0.5);
      if (vert && n.w < minS * 2 + 1) vert = false;
      if (!vert && n.h < minS * 2 + 1) vert = true;
      if (vert) {
        const s = r.int(minS, n.w - minS - 1);
        const lx = n.x + s;
        for (let y = n.y; y < n.y + n.h; y++) map.cells[I(lx, y)] = intWall;
        const a = { x: n.x, y: n.y, w: s, h: n.h }, b = { x: lx + 1, y: n.y, w: n.w - s - 1, h: n.h };
        splits.push({ vert, line: lx, from: n.y, to: n.y + n.h - 1 });
        bsp(a, depth + 1); bsp(b, depth + 1);
      } else {
        const s = r.int(minS, n.h - minS - 1);
        const ly = n.y + s;
        for (let x = n.x; x < n.x + n.w; x++) map.cells[I(x, ly)] = intWall;
        const a = { x: n.x, y: n.y, w: n.w, h: s }, b = { x: n.x, y: ly + 1, w: n.w, h: n.h - s - 1 };
        splits.push({ vert, line: ly, from: n.x, to: n.x + n.w - 1 });
        bsp(a, depth + 1); bsp(b, depth + 1);
      }
    }
    for (const b of blocks) bsp(b, 0);
    // doors on each split
    const doorTex = theme.door;
    const nearDoor = (x, y) => map.doorAt[I(x + 1, y)] >= 0 || map.doorAt[I(x - 1, y)] >= 0 || map.doorAt[I(x, y + 1)] >= 0 || map.doorAt[I(x, y - 1)] >= 0;
    function doorOnLine(vert, line, from, to, extra) {
      const cand = [];
      for (let t = from; t <= to; t++) {
        const x = vert ? line : t, y = vert ? t : line;
        if (map.cells[I(x, y)] === 0) continue;
        const ok = vert ? (map.cells[I(x - 1, y)] === 0 && map.cells[I(x + 1, y)] === 0 && map.cells[I(x, y - 1)] > 0 && map.cells[I(x, y + 1)] > 0)
          : (map.cells[I(x, y - 1)] === 0 && map.cells[I(x, y + 1)] === 0 && map.cells[I(x - 1, y)] > 0 && map.cells[I(x + 1, y)] > 0);
        if (ok && !nearDoor(x, y)) cand.push([x, y]);
      }
      if (!cand.length) return null;
      const c = r.pick(cand);
      return addDoor(c[0], c[1], doorTex);
    }
    for (const s of splits) doorOnLine(s.vert, s.line, s.from, s.to);
    // rooms
    r.shuffle(leaves);
    leaves.sort((a, b) => b.w * b.h - a.w * a.h);
    const types = roomTypes.slice();
    const rooms = [];
    leaves.forEach((lf, k) => {
      const type = k < types.length ? types[k] : r.pick(types);
      rooms.push(addRoom(type, lf.x, lf.y, lf.w, lf.h));
    });
    // corridor doors: every leaf touching the corridor walls
    if (corridor) {
      const hall = corridorRooms[0];
      for (const room of rooms) {
        const cand = [];
        for (const i of room.cells) {
          const x = i % w, y = (i / w) | 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const wx = x + dx, wy = y + dy, ox = x + dx * 2, oy = y + dy * 2;
            if (ox < 0 || oy < 0 || ox >= w || oy >= h) continue;
            if (map.cells[I(wx, wy)] > 0 && map.roomId[I(ox, oy)] === hall.id && map.cells[I(ox, oy)] === 0) {
              const pw = dx !== 0 ? [[wx, wy - 1], [wx, wy + 1]] : [[wx - 1, wy], [wx + 1, wy]];
              if (pw.every(p => map.cells[I(p[0], p[1])] > 0) && !nearDoor(wx, wy)) cand.push([wx, wy]);
            }
          }
        }
        if (cand.length && (r.chance(0.85) || true)) { const c = r.pick(cand); addDoor(c[0], c[1], doorTex); }
      }
      rooms.push(...corridorRooms);
    }
    // a few extra loops between rooms
    for (let k = 0; k < Math.floor(rooms.length / 3); k++) {
      const s = r.pick(splits); if (s) doorOnLine(s.vert, s.line, s.from, s.to);
    }
    // set exterior walls texture to theme ext (done), interior walls tex per adjacent room for variety
    for (const room of rooms) for (const i of room.cells) {
      for (const d of [1, -1, w, -w]) { const j = i + d; if (map.cells[j] > 0 && map.cells[j] === intWall && room.wallTex !== intWall && r.chance(0.5)) map.cells[j] = room.wallTex; }
    }
    return rooms;
  }

  // ---- layout per location ----
  let mainRooms = [], frontDoor = null, spawn, vanPos;
  function frontEntrance(bx, by, bw, bh) {
    // door on south wall
    const cand = [];
    for (let x = bx + 2; x < bx + bw - 2; x++) {
      const y = by + bh - 1;
      if (map.cells[I(x, y - 1)] === 0 && map.cells[I(x - 1, y)] > 0 && map.cells[I(x + 1, y)] > 0 && map.doorAt[I(x, y - 1)] < 0) cand.push(x);
    }
    cand.sort((a, b) => Math.abs(a - (bx + bw / 2)) - Math.abs(b - (bx + bw / 2)));
    const x = cand[Math.min(cand.length - 1, r.int(0, 2))];
    const d = addDoor(x, by + bh - 1, theme.front, true);
    map.roomId[I(x, by + bh - 1)] = -1;
    return d;
  }
  function doorOnSide(bx, by, bw, bh, side, tex) {
    const cand = [];
    const len = side === 'n' || side === 's' ? bw : bh;
    for (let k = 2; k < len - 2; k++) {
      let x, y, ix, iy, ox, oy;
      if (side === 's') { x = bx + k; y = by + bh - 1; ix = x; iy = y - 1; ox = x; oy = y + 1; }
      else if (side === 'n') { x = bx + k; y = by; ix = x; iy = y + 1; ox = x; oy = y - 1; }
      else if (side === 'e') { x = bx + bw - 1; y = by + k; ix = x - 1; iy = y; ox = x + 1; oy = y; }
      else { x = bx; y = by + k; ix = x + 1; iy = y; ox = x - 1; oy = y; }
      const horiz = side === 'n' || side === 's';
      const perpOk = horiz ? map.cells[I(x - 1, y)] > 0 && map.cells[I(x + 1, y)] > 0 : map.cells[I(x, y - 1)] > 0 && map.cells[I(x, y + 1)] > 0;
      if (map.cells[I(ix, iy)] === 0 && map.cells[I(ox, oy)] === 0 && perpOk && map.doorAt[I(ix, iy)] < 0) cand.push([x, y, Math.abs(k - len / 2)]);
    }
    if (!cand.length) return null;
    cand.sort((a, b) => a[2] - b[2]);
    const c = cand[Math.min(cand.length - 1, r.int(0, 2))];
    const d = addDoor(c[0], c[1], tex || theme.door);
    map.roomId[I(c[0], c[1])] = -1;
    return d;
  }
  map._extra = [];
  if (loc === 'castle') {
    // the keep: corridors, great hall, throne room, dungeon cells…
    const kw = w - 14, kh = 24;
    mainRooms = building(7, 3, kw, kh, 14, LOC_ROOMS.castle, true, 8, 'keep');
    frontDoor = frontEntrance(7, 3, kw, kh); frontDoor.tex = 23;
    const ch = building(3, 30, 12, 8, 14, ['chapel'], false, 10, 'house'); doorOnSide(3, 30, 12, 8, 'e');
    const ar = building(w - 15, 30, 12, 8, 14, ['armory', 'storage'], false, 6, 'house'); doorOnSide(w - 15, 30, 12, 8, 'w');
    const t1 = building(1, h - 7, 6, 6, 14, ['tower'], false, 6, 'tower'); doorOnSide(1, h - 7, 6, 6, 'n');
    const t2 = building(w - 7, h - 7, 6, 6, 14, ['tower'], false, 6, 'tower'); doorOnSide(w - 7, h - 7, 6, 6, 'n');
    mainRooms.push(...ch, ...ar, ...t1, ...t2);
    // banners in the great hall and throne room
    for (const rm of mainRooms) if (rm.type === 'greathall' || rm.type === 'throne') for (const i of rm.cells) for (const d of [1, -1, w, -w]) if (map.cells[i + d] > 0 && map.doorAt[i + d] < 0 && r.chance(0.18)) map.cells[i + d] = 17;
    // the great gate is shut behind you
    const gx = Math.floor(w / 2); const gate = addDoor(gx, h - 1, 23); gate.locked = 1e9;
    spawn = { x: gx + 0.5, y: h - 3.5, a: -Math.PI / 2 };
    vanPos = { x: gx + 3.5, y: h - 3.5 };
    for (let y = frontDoor.y + 1; y < h - 1; y++) map.floor[I(frontDoor.x, y)] = 37;
  } else if (loc === 'catacombs') {
    const mb = h - 10; // underground area: rows 1..mb
    map.buildings.push({ x: 0, y: 0, w: w, h: mb + 2, ext: 11, kind: 'hill' });
    for (let y = 1; y <= mb + 1; y++) for (let x = 1; x < w - 1; x++) { const i = I(x, y); map.cells[i] = 11; map.outdoor[i] = 0; map.ceil[i] = 43; map.floor[i] = 34; }
    for (let y = 0; y <= mb + 1; y++) { map.cells[I(0, y)] = 11; map.cells[I(w - 1, y)] = 11; }
    for (let x = 0; x < w; x++) map.cells[I(x, 0)] = 11;
    // labyrinth (recursive backtracker on odd cells)
    const seen = new Uint8Array(w * h);
    const st = [[1, 1]]; seen[I(1, 1)] = 1; map.cells[I(1, 1)] = 0;
    while (st.length) {
      const [cx, cy] = st[st.length - 1];
      const nb = r.shuffle([[2, 0], [-2, 0], [0, 2], [0, -2]]).map(([dx, dy]) => [cx + dx, cy + dy, dx, dy]).filter(([nx, ny]) => nx > 0 && ny > 0 && nx < w - 1 && ny < mb && !seen[I(nx, ny)]);
      if (!nb.length) { st.pop(); continue; }
      const [nx, ny, dx, dy] = nb[0];
      seen[I(nx, ny)] = 1; map.cells[I(nx, ny)] = 0; map.cells[I(cx + dx / 2, cy + dy / 2)] = 0;
      st.push([nx, ny]);
    }
    // extra loops so it is not a perfect maze
    for (let k = 0; k < 70; k++) { const x = r.int(2, w - 3), y = r.int(2, mb - 2); const i = I(x, y); if (map.cells[i] > 0 && ((map.cells[i - 1] === 0 && map.cells[i + 1] === 0) || (map.cells[i - w] === 0 && map.cells[i + w] === 0))) map.cells[i] = 0; }
    // burial chambers
    const types = ['ossuary', 'tomb', 'crypt', 'shrine', 'ossuary', 'tomb', 'crypt', 'tomb', 'ossuary'];
    mainRooms = [];
    for (let k = 0; k < types.length; k++) {
      const rw = r.int(3, 6), rh = r.int(3, 5), rx = r.int(1, w - 2 - rw) | 1, ry = r.int(1, mb - 1 - rh) | 1;
      if (rx + rw >= w - 1 || ry + rh >= mb) continue;
      if (mainRooms.some(o => rx < o.x + o.w + 1 && rx + rw + 1 > o.x && ry < o.y + o.h + 1 && ry + rh + 1 > o.y)) continue;
      for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) map.cells[I(x, y)] = 0;
      mainRooms.push(addRoom(types[k], rx, ry, rw, rh));
    }
    // iron gates in narrow passages
    for (let k = 0; k < 400 && map.doors.length < 12; k++) {
      const x = r.int(2, w - 3), y = r.int(2, mb - 1), i = I(x, y);
      if (map.cells[i] !== 0 || map.roomId[i] > 0) continue;
      const hz = map.cells[i - 1] > 0 && map.cells[i + 1] > 0 && map.cells[i - w] === 0 && map.cells[i + w] === 0;
      const vt = map.cells[i - w] > 0 && map.cells[i + w] > 0 && map.cells[i - 1] === 0 && map.cells[i + 1] === 0;
      if ((hz || vt) && ![1, -1, w, -w].some(d => map.doorAt[i + d] >= 0)) { map.cells[i] = 5; addDoor(x, y, 22); }
    }
    // entrance from the graveyard
    let ex = (Math.floor(w / 2) | 1);
    map.cells[I(ex, mb)] = 0; map.cells[I(ex, mb - 1)] = 0;
    frontDoor = addDoor(ex, mb + 1, 22, true);
    const passage = addRoom('hall', 1, 1, w - 2, mb, undefined, true);
    mainRooms.push(passage);
    for (const i of passage.cells) if (r.chance(0.25)) for (const d of [1, -1, w, -w]) if (map.cells[i + d] === 11) map.cells[i + d] = 18;
    spawn = { x: ex + 0.5, y: h - 4.5, a: -Math.PI / 2 };
    vanPos = { x: ex + 3.5, y: h - 3.5 };
    for (let y = mb + 2; y < h - 1; y++) map.floor[I(ex, y)] = 37;
  } else if (loc === 'church') {
    const bw = 22, bh = 26, bx = Math.floor(w / 2) - 11, by = 3;
    map.buildings.push({ x: bx, y: by, w: bw, h: bh, ext: 14, kind: 'church', tower: { x: bx + bw - 6, y: by + 1, w: 5, h: 6 } });
    for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) { const i = I(x, y); map.cells[i] = 14; map.outdoor[i] = 0; map.ceil[i] = 41; }
    for (let y = by + 1; y < by + bh - 1; y++) for (let x = bx + 1; x < bx + bw - 1; x++) map.cells[I(x, y)] = 0;
    const iw = 13, cx = bx + Math.floor(bw / 2);
    const vline = (x, y0, y1) => { for (let y = y0; y <= y1; y++) map.cells[I(x, y)] = iw; };
    const hline = (y, x0, x1) => { for (let x = x0; x <= x1; x++) map.cells[I(x, y)] = iw; };
    hline(by + 7, bx + 1, bx + bw - 2);
    vline(bx + 6, by + 1, by + 6); vline(bx + bw - 7, by + 1, by + 6);
    vline(bx + 5, by + 8, by + bh - 2); vline(bx + bw - 6, by + 8, by + bh - 2);
    const mid = by + 8 + Math.floor((bh - 9) / 2);
    hline(mid, bx + 1, bx + 4); hline(mid, bx + bw - 5, bx + bw - 2);
    addDoor(cx, by + 7, 22); addDoor(bx + 6, by + 3, 22); addDoor(bx + bw - 7, by + 3, 22);
    addDoor(bx + 5, by + 11, 22); addDoor(bx + 5, mid + 4, 22); addDoor(bx + bw - 6, by + 11, 22); addDoor(bx + bw - 6, mid + 4, 22);
    mainRooms = [
      addRoom('apse', bx + 7, by + 1, bw - 14, 6), addRoom('sacristy', bx + 1, by + 1, 5, 6), addRoom('belltower', bx + bw - 6, by + 1, 5, 6),
      addRoom('nave', bx + 6, by + 8, bw - 12, bh - 9),
      addRoom('chapel', bx + 1, by + 8, 4, mid - by - 8), addRoom('chapel', bx + 1, mid + 1, 4, by + bh - 2 - mid),
      addRoom('chapel', bx + bw - 5, by + 8, 4, mid - by - 8), addRoom('chapel', bx + bw - 5, mid + 1, 4, by + bh - 2 - mid)
    ];
    // pews either side of the aisle
    for (let y = by + 10; y < by + bh - 4; y += 2) for (const x of [bx + 7, bx + 8, cx + 2, cx + 3]) map._extra.push([x, y, 'pew', mainRooms[3].id]);
    frontDoor = addDoor(cx, by + bh - 1, 22, true); map.roomId[I(cx, by + bh - 1)] = -1;
    const hut = building(3, h - 13, 9, 7, 12, ['hut'], false, 8, 'barn'); doorOnSide(3, h - 13, 9, 7, 'n');
    const mz = building(w - 12, h - 13, 9, 7, 14, ['tomb'], false, 8, 'mausoleum'); doorOnSide(w - 12, h - 13, 9, 7, 'n');
    mainRooms.push(...hut, ...mz);
    spawn = { x: cx + 0.5, y: by + bh + 4.5, a: -Math.PI / 2 };
    vanPos = { x: cx + 3.5, y: by + bh + 6.5 };
    for (let y = by + bh; y < h - 1; y++) map.floor[I(cx, y)] = 37;
  } else if (loc === 'farm') {
    const hb = { x: 4, y: 4, w: r.int(15, 18), h: r.int(12, 14) };
    mainRooms = building(hb.x, hb.y, hb.w, hb.h, theme.ext, LOC_ROOMS.farmhouse, false, 6, 'house');
    frontDoor = frontEntrance(hb.x, hb.y, hb.w, hb.h);
    const bb = { x: w - 18, y: 5, w: 13, h: 11 };
    const barn = building(bb.x, bb.y, bb.w, bb.h, theme.rooms.barn[0], ['barn', 'barn', 'shed'], false, 9, 'barn');
    const bd = frontEntrance(bb.x, bb.y, bb.w, bb.h); bd.tex = 23;
    const sb = { x: w - 14, y: h - 15, w: 8, h: 7 };
    const shed = building(sb.x, sb.y, sb.w, sb.h, theme.rooms.shed[0], ['shed'], false, 6, 'barn');
    const sd = frontEntrance(sb.x, sb.y, sb.w, sb.h); sd.tex = 23;
    mainRooms.push(...barn, ...shed);
    spawn = { x: frontDoor.x + 0.5, y: frontDoor.y + 5.5, a: -Math.PI / 2 };
    vanPos = { x: frontDoor.x + 2.5, y: frontDoor.y + 7.5 };
    // paths
    for (let y = frontDoor.y + 1; y < h - 1; y++) map.floor[I(frontDoor.x, y)] = 37;
  } else {
    const B = { house: [22, 18, 6], hospital: [40, 28, 8], school: [38, 26, 9] }[loc];
    const bw = B[0] + r.int(-2, 2), bh = B[1] + r.int(-2, 1);
    const bx = Math.floor((w - bw) / 2), by = 2;
    mainRooms = building(bx, by, bw, bh, theme.ext, LOC_ROOMS[loc], loc !== 'house', B[2], loc === 'house' ? 'house' : 'big');
    frontDoor = frontEntrance(bx, by, bw, bh);
    spawn = { x: frontDoor.x + 0.5, y: frontDoor.y + 3.5, a: -Math.PI / 2 };
    vanPos = { x: frontDoor.x + 0.5 + (r.chance(0.5) ? 3 : -3), y: frontDoor.y + 5.5 };
    for (let y = frontDoor.y + 1; y < h - 1; y++) map.floor[I(frontDoor.x, y)] = era === 'modern' ? 38 : 37;
  }
  map.frontDoor = frontDoor.i;
  map.spawn = spawn;
  map.van = vanPos;

  // ---- objects ----
  let oid = 0;
  const addObj = (o) => { o.id = oid++; map.objects.push(o); return o; };
  const swap = (s) => era === 'medieval' && MED_SWAP[s] ? MED_SWAP[s] : s;
  const isFree = (i) => map.cells[i] === 0 && map.doorAt[i] < 0 && map.blockObj[i] < 0;
  const nearAnyDoor = (i) => [1, -1, w, -w, w + 1, w - 1, -w + 1, -w - 1].some(d => map.doorAt[i + d] >= 0);
  function placeBlocking(room, sprName, hide, edgeOnly) {
    const cand = room.cells.filter(i => isFree(i) && !nearAnyDoor(i) && (!edgeOnly || [1, -1, w, -w].some(d => map.cells[i + d] > 0)));
    if (!cand.length) return null;
    const i = r.pick(cand);
    const x = i % w, y = (i / w) | 0;
    // push slightly toward the wall
    let ox = 0.5, oy = 0.5;
    if (map.cells[i - 1] > 0) ox = 0.42; else if (map.cells[i + 1] > 0) ox = 0.58;
    if (map.cells[i - w] > 0) oy = 0.42; else if (map.cells[i + w] > 0) oy = 0.58;
    const o = addObj({ kind: 'furn', spr: sprName, x: x + ox, y: y + oy, rad: 0.42, block: true, hide: !!HIDE[sprName], room: room.id, sh: SPR_H[sprName] || 0.62, cell: i });
    map.blockObj[i] = o.id;
    return o;
  }
  for (const [x, y, sp, room] of map._extra) { const i = I(x, y); if (map.cells[i] === 0 && map.blockObj[i] < 0) map.blockObj[i] = addObj({ kind: 'furn', spr: sp, x: x + 0.5, y: y + 0.5, rad: 0.42, block: true, room, sh: SPR_H[sp] || 0.62, cell: i }).id; }
  const allRooms = mainRooms.filter(rm => rm.cells.length);
  for (const room of allRooms) {
    const list = FURN[room.type] || [];
    for (const [s, lo, hi] of list) {
      let n = r.int(lo, hi);
      if (room.cells.length < 12) n = Math.min(n, 1);
      for (let k = 0; k < n; k++) placeBlocking(room, swap(s), false, true);
    }
    if (room.type === 'hall' && (loc === 'school' || loc === 'hospital')) {
      for (let k = 0; k < 5; k++) placeBlocking(room, swap('locker'), true, true);
    }
  }
  // outdoor decoration
  const yardCells = [];
  for (let i = 0; i < N; i++) if (map.outdoor[i] && map.cells[i] === 0) yardCells.push(i);
  const nearBuilding = (i) => { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const j = i + dy * w + dx; if (!map.outdoor[j] || map.doorAt[j] >= 0) return true; } return false; };
  const outCount = loc === 'farm' ? 40 : loc === 'church' ? 90 : loc === 'catacombs' ? 30 : loc === 'castle' ? 10 : 18;
  for (let k = 0; k < outCount; k++) {
    const i = r.pick(yardCells);
    const x = i % w, y = (i / w) | 0;
    if (!isFree(i) || nearBuilding(i) || Math.abs(x + 0.5 - spawn.x) + Math.abs(y + 0.5 - spawn.y) < 4 || Math.abs(x + 0.5 - vanPos.x) + Math.abs(y + 0.5 - vanPos.y) < 3 || (map.floor[i] !== 36 && map.floor[i] !== 38)) continue;
    const s = r.pick(loc === 'farm' ? ['tree', 'deadtree', 'grave', 'hay', 'tree', 'barrel', 'grave'] : loc === 'church' || loc === 'catacombs' ? ['grave', 'grave', 'grave', 'deadtree', 'grave'] : loc === 'castle' ? ['barrel', 'crate', 'hay', 'well'] : ['tree', 'deadtree', 'grave', 'tree']);
    const o = addObj({ kind: 'furn', spr: s, x: x + 0.5, y: y + 0.5, rad: s === 'grave' ? 0.3 : 0.35, block: true, hide: s === 'hay', room: 0, sh: SPR_H[s], cell: i });
    map.blockObj[i] = o.id;
  }
  if (loc === 'farm') { const i = r.pick(yardCells.filter(c => isFree(c) && !nearBuilding(c))); map.blockObj[i] = addObj({ kind: 'furn', spr: 'well', x: (i % w) + 0.5, y: ((i / w) | 0) + 0.5, rad: 0.4, block: true, room: 0, sh: 0.7, cell: i }).id; }

  // van / cart and equipment
  const vi = I(Math.floor(vanPos.x), Math.floor(vanPos.y));
  map.vanObj = addObj({ kind: 'van', spr: era === 'modern' ? 'van' : 'cart', x: vanPos.x, y: vanPos.y, rad: 0.7, block: true, room: 0, sh: 0.9, cell: vi }).id;
  map.blockObj[vi] = map.vanObj;
  for (const d of [-w, w]) if (map.cells[vi + d] === 0 && map.outdoor[vi + d] && map.blockObj[vi + d] < 0) map.blockObj[vi + d] = map.vanObj;
  const ei = I(Math.floor(vanPos.x) + (vanPos.x > spawn.x ? -1 : 1), Math.floor(vanPos.y));
  map.equipObj = addObj({ kind: 'equip', spr: era === 'modern' ? 'equip' : 'chest', x: (ei % w) + 0.5, y: ((ei / w) | 0) + 0.5, rad: 0.35, block: true, room: 0, sh: 0.55, cell: ei }).id;
  map.blockObj[ei] = map.equipObj;

  // ---- lights ----
  const lightRooms = allRooms.filter(rm => rm.cells.length >= 4);
  for (const room of lightRooms) {
    if (era === 'modern') {
      // one bulb per ~30 cells
      const n = Math.max(1, Math.round(room.cells.length / 35));
      for (let k = 0; k < n; k++) {
        const free = room.cells.filter(i => map.blockObj[i] < 0 && map.doorAt[i] < 0);
        const i = n === 1 ? free.reduce((b, c) => { const d = Math.hypot((c % w) + 0.5 - room.cx, ((c / w) | 0) + 0.5 - room.cy); return d < b[0] ? [d, c] : b; }, [1e9, free[0]])[1] : r.pick(free);
        if (i === undefined) continue;
        const o = addObj({ kind: 'lamp', spr: 'bulb', x: (i % w) + 0.5, y: ((i / w) | 0) + 0.5, rad: 0, block: false, room: room.id, sh: 0.5, z: 0.5 });
        map.lights.push({ id: map.lights.length, obj: o.id, x: o.x, y: o.y, room: room.id, rad: 5 + Math.sqrt(room.cells.length) * 0.6, col: [1.0, 0.86, 0.6], pow: 1.1, on: false, broken: r.chance(0.22), kind: 'lamp' });
        o.light = map.lights.length - 1;
      }
    } else {
      // wall torches beside walls
      const n = Math.max(1, Math.round(room.cells.length / 30));
      for (let k = 0; k < n; k++) {
        const edge = room.cells.filter(i => map.blockObj[i] < 0 && map.doorAt[i] < 0 && !nearAnyDoor(i) && [1, -1, w, -w].some(d => map.cells[i + d] > 0));
        if (!edge.length) break;
        const i = r.pick(edge); const x = i % w, y = (i / w) | 0;
        let ox = 0.5, oy = 0.5;
        if (map.cells[i - 1] > 0) ox = 0.12; else if (map.cells[i + 1] > 0) ox = 0.88; else if (map.cells[i - w] > 0) oy = 0.12; else oy = 0.88;
        const o = addObj({ kind: 'lamp', spr: 'walltorch', x: x + ox, y: y + oy, rad: 0, block: false, room: room.id, sh: 0.5, z: 0.35 });
        map.lights.push({ id: map.lights.length, obj: o.id, x: o.x, y: o.y, room: room.id, rad: 4.5 + Math.sqrt(room.cells.length) * 0.4, col: [1.0, 0.6, 0.3], pow: 1.0, on: r.chance(0.25), broken: false, kind: 'torch' });
        o.light = map.lights.length - 1;
      }
    }
  }
  // van light / lantern
  map.lights.push({ id: map.lights.length, obj: -1, x: vanPos.x, y: vanPos.y + 0.8, room: 0, rad: 5, col: era === 'modern' ? [0.7, 0.8, 1.0] : [1.0, 0.65, 0.35], pow: 0.8, on: true, broken: false, kind: 'van' });

  // ---- small throwables ----
  const throwSpr = ['book', 'cup', 'ball', 'toy', 'book', 'cup'];
  for (const room of allRooms) {
    if (room.type === 'hall' && r.chance(0.6)) continue;
    const n = r.int(0, 2);
    for (let k = 0; k < n; k++) {
      const free = room.cells.filter(i => map.blockObj[i] < 0 && map.doorAt[i] < 0); if (!free.length) break;
      const i = r.pick(free);
      addObj({ kind: 'throw', spr: r.pick(throwSpr), x: (i % w) + 0.2 + r() * 0.6, y: ((i / w) | 0) + 0.2 + r() * 0.6, rad: 0, block: false, room: room.id, sh: 0.25 });
    }
    if (era === 'medieval' && r.chance(0.35)) {
      const free = room.cells.filter(i => map.blockObj[i] < 0 && map.doorAt[i] < 0); if (free.length) { const i = r.pick(free); addObj({ kind: 'deco', spr: 'candlesoff', x: (i % w) + 0.5, y: ((i / w) | 0) + 0.5, rad: 0, block: false, room: room.id, sh: 0.3 }); }
    }
  }
  map.allRooms = allRooms;
  map.r = r;

  // ---- connectivity check: remove blocking furniture until everything is reachable ----
  function reach() {
    const seen = new Uint8Array(N); const q = [I(Math.floor(spawn.x), Math.floor(spawn.y))]; seen[q[0]] = 1;
    while (q.length) { const c = q.pop(); for (const d of [1, -1, w, -w]) { const j = c + d; if (!seen[j] && map.cells[j] === 0 && map.blockObj[j] < 0) { seen[j] = 1; q.push(j); } } }
    return seen;
  }
  for (let iter = 0; iter < 60; iter++) {
    const seen = reach();
    let fixed = false;
    for (let i = 0; i < N; i++) {
      if (map.cells[i] === 0 && map.blockObj[i] < 0 && !seen[i]) {
        // remove a neighbouring blocker
        for (const d of [1, -1, w, -w]) { const o = map.blockObj[i + d]; if (o >= 0 && map.objects[o].kind === 'furn') { map.objects[o].removed = true; map.blockObj[i + d] = -1; fixed = true; break; } }
        if (fixed) break;
      }
    }
    if (!fixed) break;
  }
  map.objects = map.objects.filter(o => !o.removed);
  // re-index ids
  const remap = {};
  map.objects.forEach((o, k) => { remap[o.id] = k; o.id = k; });
  map.blockObj.fill(-1);
  for (const o of map.objects) if (o.block && o.cell !== undefined) map.blockObj[o.cell] = o.id;
  for (const l of map.lights) if (l.obj >= 0) l.obj = remap[l.obj];
  map.vanObj = remap[map.vanObj]; map.equipObj = remap[map.equipObj];
  { const vo = map.objects[map.vanObj]; if (vo) for (const d of [-w, w]) { const j = vo.cell + d; if (map.cells[j] === 0 && map.outdoor[j] && map.blockObj[j] < 0) map.blockObj[j] = vo.id; } }

  // ---- light coverage precompute ----
  GH.precomputeLights(map);
  return map;
};

// the hunters' hideout where players gather before a mission
GH.genLobbyMap = function (era) {
  const w = 14, h = 11, N = w * h;
  const med = era === 'medieval';
  const map = { w, h, era, loc: 'lobby', seed: 1, cells: new Uint8Array(N), doorAt: new Int16Array(N).fill(-1), floor: new Uint8Array(N), ceil: new Uint8Array(N),
    roomId: new Int16Array(N).fill(-1), outdoor: new Uint8Array(N), blockObj: new Int16Array(N).fill(-1), doors: [], rooms: [], objects: [], lights: [] };
  const wallA = med ? 9 : 7, wallB = med ? 10 : 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, edge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
    map.cells[i] = edge ? (y === 0 || x === 0 ? wallA : wallB) : 0;
    map.floor[i] = med ? 34 : 30; map.ceil[i] = med ? 41 : 40;
  }
  map.rooms.push({ id: 0, type: 'yard', cells: [], outdoor: true });
  const room = { id: 1, type: 'lobby', x: 1, y: 1, w: w - 2, h: h - 2, cx: w / 2, cy: h / 2, cells: [] };
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; map.roomId[i] = 1; room.cells.push(i); }
  map.rooms.push(room); map.allRooms = [room];
  let oid = 0;
  const add = (o) => { o.id = oid++; map.objects.push(o); if (o.block) { o.cell = Math.floor(o.y) * w + Math.floor(o.x); map.blockObj[o.cell] = o.id; } return o; };
  map.boardObj = add({ kind: 'board', spr: 'board', x: w / 2, y: 1.08, rad: 0, block: false, room: 1, sh: 0.62, z: 0.22 }).id;
  add({ kind: 'furn', spr: 'table', x: 6.5, y: 5.5, block: true, room: 1, sh: 0.62 });
  add({ kind: 'furn', spr: 'table', x: 7.5, y: 5.5, block: true, room: 1, sh: 0.62 });
  for (const [x, y] of [[5.5, 5.5], [8.5, 5.5], [6.5, 6.5], [7.5, 4.5]]) add({ kind: 'furn', spr: 'chair', x, y, block: true, room: 1, sh: 0.62 });
  for (const x of [1.5, 2.5, 11.5, 12.5]) add({ kind: 'furn', spr: 'shelf', x, y: 1.45, block: true, room: 1, sh: 1.0 });
  add({ kind: 'furn', spr: med ? 'barrel' : 'crate', x: 1.5, y: 8.5, block: true, room: 1, sh: 0.62 });
  add({ kind: 'furn', spr: med ? 'chest' : 'equip', x: 12.5, y: 8.5, block: true, room: 1, sh: 0.55 });
  add({ kind: 'deco', spr: 'candles', x: 7, y: 5.45, room: 1, sh: 0.3, z: 0.62 });
  for (const [x, y] of [[4, 3.5], [10, 7.5]]) {
    const o = add({ kind: 'lamp', spr: med ? 'walltorch' : 'bulb', x, y, rad: 0, block: false, room: 1, sh: 0.5, z: med ? 0.35 : 0.5 });
    map.lights.push({ id: map.lights.length, obj: o.id, x, y, room: 1, rad: 9, col: med ? [1, 0.62, 0.32] : [1, 0.82, 0.55], pow: 0.9, on: true, broken: false, kind: med ? 'torch' : 'lamp' });
    o.light = map.lights.length - 1;
  }
  map.spawn = { x: w / 2, y: h - 2.5, a: -Math.PI / 2 };
  map.van = { x: w / 2, y: h / 2 };
  map.frontDoor = -1;
  GH.precomputeLights(map);
  return map;
};

GH.roomAt = (map, x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= map.w || yi >= map.h) return -1;
  return map.roomId[yi * map.w + xi];
};

GH.precomputeLights = function (map) {
  const w = map.w;
  const block = (i) => map.cells[i] > 0;
  for (const L of map.lights) {
    L.cells = [];
    const R = Math.ceil(L.rad);
    const lx = Math.floor(L.x), ly = Math.floor(L.y);
    for (let y = ly - R; y <= ly + R; y++) for (let x = lx - R; x <= lx + R; x++) {
      if (x < 0 || y < 0 || x >= map.w || y >= map.h) continue;
      const d = Math.hypot(x + 0.5 - L.x, y + 0.5 - L.y);
      if (d > L.rad) continue;
      const i = y * w + x;
      if (!GH.los(map, L.x, L.y, x + 0.5, y + 0.5, block)) continue;
      const f = Math.pow(1 - d / L.rad, 1.6);
      L.cells.push(i, f);
    }
  }
};
