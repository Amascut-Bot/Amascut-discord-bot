import 'dotenv/config';
import { GatewayIntentBits } from 'discord.js';
import { Indomitable, IndomitableOptions } from 'indomitable';
import Bot from './src/Bot';

if (!process.env.TOKEN) throw new Error('Token Missing');
if (!process.env.ENVIRONMENT) throw new Error('Environment Missing');

const { Guilds, GuildMembers, GuildBans, GuildVoiceStates, GuildMessages, GuildMessageReactions, MessageContent } = GatewayIntentBits;

const sharderOptions: IndomitableOptions = {
    clientOptions: {
        // disableMentions: 'everyone',
        // restRequestTimeout: 30000,
        intents: [Guilds, GuildMembers, GuildBans, GuildVoiceStates, GuildMessages, GuildMessageReactions, MessageContent, Guilds, GuildVoiceStates],
    },
    client: Bot as any,
    autoRestart: true,
    token: process.env.TOKEN ?? '',
    clusterCount: 1,
};

const manager = new Indomitable(sharderOptions).on('error', console.error).on('debug', (message) => {
    console.log(`[ClusterHandler] [Main] ${message}`);
});

manager.spawn();
