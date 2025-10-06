import { ApplicationCommandOption, SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder, SlashCommandOptionsOnlyBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';
import * as uuid from 'uuid';
import Bot from '../Bot';

export default interface BotInteraction {
    new(client: Bot): BotInteraction;
    uid: string;
    client: Bot;
    category: string;
    get name(): string;
    get description(): string;
    get slashData(): SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder | SlashCommandOptionsOnlyBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
    get permissions(): ApplicationCommandOption[] | string;
    run(interaction: ChatInputCommandInteraction): Promise<any>;
    autocomplete?(interaction: AutocompleteInteraction): Promise<any>;
}

export default class BotInteraction {
    constructor(client: Bot) {
        this.uid = uuid.v4();
        this.client = client;
    }
}
