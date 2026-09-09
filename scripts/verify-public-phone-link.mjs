import assert from 'node:assert/strict';
import { publicPhoneLink } from '../shared/publicPhoneLink.js';
assert.equal(publicPhoneLink('0356 460 785 / 0742 224 450'), 'tel:0356460785');
assert.equal(publicPhoneLink('+40 (356) 460-785; +40 742 224 450'), 'tel:+40356460785');
assert.equal(publicPhoneLink('Telefon: 0040 356 460 785'), 'tel:+40356460785');
assert.equal(publicPhoneLink('indisponibil / 0742 224 450'), 'tel:0742224450');
assert.equal(publicPhoneLink('03564607850742224450'), null);
for (const value of [null, undefined, '', 356460785, 'N/A', '123']) assert.equal(publicPhoneLink(value), null);
console.log('Public phone links: PASS');
