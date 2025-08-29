import * as dotenv from 'dotenv';
dotenv.config();
import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import Bot from './src/Bot';

// basic error checking
if (!process.env.TOKEN) throw new Error('Token Missing');
if (!process.env.ENVIRONMENT) throw new Error('Environment Missing');

const client = new Bot({
    intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.GuildVoiceStates,
            GatewayIntentBits.MessageContent, // needed for message parsing
        ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.login();
