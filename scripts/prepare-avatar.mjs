import { prepareAvatar } from './prepare-cast.mjs';
if (!process.argv[2]) throw new Error('Usage: node scripts/prepare-avatar.mjs /path/to/VRM1_Constraint_Twist_Sample.vrm');
await prepareAvatar('yui', process.argv[2]);
