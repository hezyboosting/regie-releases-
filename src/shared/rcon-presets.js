// Serveurs de jeu pilotables à distance : protocole, port par défaut et exemples de commandes.
// {user}, {gift}, {amount} et {pseudo} (ton pseudo en jeu, réglé dans Mes jeux) sont remplacés à l'envoi.
'use strict';

const RCON_PRESETS = {
  minecraft: { name: 'Minecraft', kind: 'source', port: 25575, examples: ['say {user} t\'envoie {gift} !', 'execute at @a run summon minecraft:zombie ~3 ~ ~', 'give @a minecraft:diamond 1'] },
  rust: { name: 'Rust', kind: 'webrcon', port: 28016, examples: ['say {user} t\'envoie {gift} !', 'inventory.giveto "{pseudo}" wood 500', 'env.time 0'] },
  ark: { name: 'ARK', kind: 'source', port: 27020, examples: ['ServerChat {user} t\'envoie {gift} !', 'Broadcast Merci {user} !', 'SetTimeOfDay 22:00'] },
  palworld: { name: 'Palworld', kind: 'source', port: 25575, examples: ['Broadcast Merci_{user}', 'Save'] },
  gmod: { name: 'Garry\'s Mod', kind: 'source', port: 27015, examples: ['say {user} t\'envoie {gift} !', 'ulx slap "{pseudo}" 0'] },
  cs2: { name: 'Counter-Strike 2 (serveur privé)', kind: 'source', port: 27015, examples: ['say {user} t\'envoie {gift} !', 'sv_gravity 200', 'mp_restartgame 1'] },
  conan: { name: 'Conan Exiles', kind: 'source', port: 25575, examples: ['broadcast Merci {user} !'] },
  squad: { name: 'Squad', kind: 'source', port: 21114, examples: ['AdminBroadcast Merci {user} !'] },
  factorio: { name: 'Factorio', kind: 'source', port: 27015, examples: ['/silent-command game.print("Merci {user} !")'] },
  sdtd: { name: '7 Days to Die', kind: 'telnet', port: 8081, examples: ['say "Merci {user} !"', 'spawnwanderinghorde'] },
  other: { name: 'Autre serveur (RCON Source)', kind: 'source', port: 27015, examples: ['say Merci {user} !'] },
};

module.exports = { RCON_PRESETS };
