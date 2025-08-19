import * as dotenv from 'dotenv';
dotenv.config();
import { GatewayIntentBits, Partials } from 'discord.js';
import { Indomitable, IndomitableOptions } from 'indomitable';
import Bot from './src/Bot';

// basic error checking
if (!process.env.TOKEN) throw new Error('Token Missing');
if (!process.env.ENVIRONMENT) throw new Error('Environment Missing');

const options: IndomitableOptions = {
    token: process.env.TOKEN,
    clientOptions: {
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.MessageContent, // needed for message parsing
        ],
        partials: [Partials.Message, Partials.Channel, Partials.Reaction],
    },
    autoRestart: true,
    spawnTimeout: 60000, // 1 minute
    client: Bot as any,
};

const manager = new Indomitable(options)
    .on('error', (err) => {
        console.log(`[ClusterHandler] [Main] ${err}`);
    })
    .on('debug', (message) => {
        console.log(`[ClusterHandler] [Main] ${message}`);
    });

// start the bot
// patze is indeed cute
manager.spawn();
