import * as dotenv from 'dotenv';
dotenv.config();
import { GatewayIntentBits, Partials } from 'discord.js';
import Bot from './src/Bot';
import { usePrivilegedIntents } from './src/privilegedIntents';

// basic error checking
if (!process.env.TOKEN) throw new Error('Token Missing');
if (!process.env.ENVIRONMENT) throw new Error('Environment Missing');

const privilegedIntents = usePrivilegedIntents();

const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
];

if (privilegedIntents) {
    intents.push(GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent);
}

const client = new Bot({
    intents,
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.logger.log({
    message: privilegedIntents
        ? 'Connecting with privileged intents (GuildMembers, MessageContent)'
        : 'Connecting without privileged intents. Message parsing, automod, and join-role assignment are disabled until PRIVILEGED_INTENTS=true.',
}, true);

client.login();
