import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, MessageFlags } from "discord.js";
import BotInteraction from "../../types/BotInteraction";
import TwitchHandler from "../../modules/TwitchHandler";

export default class RemoveStreamer extends BotInteraction {
    get name(): string {
        return 'remove-streamer';
    }

    get description(): string {
        return 'Removes a Twitch streamer from the notification list.';
    }

    get permissions() {
        return 'ADMIN';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addStringOption(option =>
                option.setName('username')
                    .setDescription('The Twitch username to remove.')
                    .setRequired(true)
                    .setAutocomplete(true));
    }

    async autocomplete(interaction: AutocompleteInteraction) {
        const focusedValue = interaction.options.getFocused();
        const streamers = await TwitchHandler.readStreamers();
        const choices = streamers.map(s => ({ name: s.displayName, value: s.userName }));
        const filtered = choices.filter(choice => choice.name.toLowerCase().includes(focusedValue.toLowerCase()));
        await interaction.respond(filtered.slice(0, 25));
    }

    async run(interaction: ChatInputCommandInteraction) {
        if (!interaction.inCachedGuild()) return;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const userNameToRemove = interaction.options.getString('username', true);

        const streamers = await TwitchHandler.readStreamers();
        const initialLength = streamers.length;

        const newStreamers = streamers.filter(s => s.userName.toLowerCase() !== userNameToRemove.toLowerCase());

        if (newStreamers.length === initialLength) {
            return interaction.editReply({ content: `Could not find a streamer with the username \`${userNameToRemove}\` on the notification list.` });
        }

        await TwitchHandler.writeStreamers(newStreamers);

        this.client.logger.log({
            message: `Removed streamer ${userNameToRemove} from the notification list.`,
            user: interaction.user.username,
            handler: this.constructor.name
        }, true);

        await interaction.editReply({ content: `Successfully removed **${userNameToRemove}** from the notification list.` });
    }
}
