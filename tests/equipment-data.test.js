const assert = require('node:assert/strict');
const fs = require('node:fs');

const data = JSON.parse(fs.readFileSync('data/equipment/crossfire.json', 'utf8'));
const html = fs.readFileSync('docs/equipment-explorer.html', 'utf8');

function item(nick) {
  const result = data.items[nick];
  assert.ok(result, `missing equipment item ${nick}`);
  return result;
}

const gun = item('fc_c_gun01_mark01');
assert.equal(gun.stats.projectile_archetype, 'fc_c_gun01_mark01_ammo');
assert.equal(gun.stats.hull_damage, 121.199997);
assert.equal(gun.stats.energy_damage, 0);
assert.equal(gun.stats.damage_source, 'munition');

const missile = item('coal_missile_mark06');
assert.equal(missile.stats.projectile_archetype, 'coal_missile_mark06_ammo');
assert.equal(missile.stats.explosion_arch, 'coal_missile_mark06_explosion');
assert.equal(missile.stats.hull_damage, 747);
assert.equal(missile.stats.explosion_hull_damage, 747);
assert.equal(missile.stats.blast_radius, 16);
assert.equal(missile.stats.damage_source, 'explosion');

const shield = item('shield03_mark07_lf');
assert.equal(shield.stats.shield_capacity, 2960);
assert.equal(shield.stats.regeneration_rate, 65.800003);
assert.equal(shield.stats.shield_type, 'S_Positron01');

assert.match(html, /detail_equipment_info/);
assert.match(html, /stat_hull_damage/);
assert.match(html, /stat_shield_capacity/);

console.log('equipment data test passed');
