import path = require('path');
import BotInteraction from '../../types/BotInteraction';
import { ChatInputCommandInteraction, SlashCommandBuilder, Role, MessageFlags, AttachmentBuilder, TextChannel } from 'discord.js';
import fs = require('fs');
import axios from 'axios';
const svg2img = require('svg2img');

export default class GetRoleImage extends BotInteraction {
    get name() {
        return 'get-role-image';
    }

    get description() {
        return 'Returns the Image of a Discord Role';
    }

    get permissions() {
        return 'EDITOR';
    }

    get slashData() {
        return new SlashCommandBuilder()
            .setName(this.name)
            .setDescription(this.description)
            .addRoleOption((option) => option.setName('role').setDescription('Role, whose Image to return').setRequired(true))
            .addBooleanOption((option) => option.setName('defaulticon').setDescription('Grab Default Icon with the colour instead of image').setRequired(true));
    }

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const role: Role = interaction.options.getRole('role', true) as Role;
        const defaultIcon: boolean = interaction.options.getBoolean('defaulticon', true);

        const iconUrl = role.iconURL();

        if (iconUrl && !defaultIcon) {
            const image = await axios.get(iconUrl, { responseType: 'arraybuffer' });

            if (image) {
                const attachment = new AttachmentBuilder(Buffer.from(image.data, 'binary'), {
                    name: `${role.name}.png`,
                });

                (interaction.channel as TextChannel).send({ content: 'Downloaded file:', files: [attachment]});
            }
        } else {
            const roleColour = role.hexColor;

            if (roleColour) {
                const svgPath = path.resolve(__dirname, '../../resource/discord_roleicon.svg');
                const discord_roleicon = fs.readFileSync(svgPath, 'utf-8');

                const newIcon = discord_roleicon.replace('<path fill="#000000"', `<path fill="${roleColour}"`)

                svg2img(newIcon, function(error: any, buffer: any) {
                    if (error) {
                        return interaction.editReply(error);
                    }

                    const attachment = new AttachmentBuilder(Buffer.from(buffer, 'utf-8'), {
                        name: `${role.name}.png`,
                    });

                    (interaction.channel as TextChannel).send({ content: 'Downloaded file:', files: [attachment]});
                });
            }
        }

        await interaction.editReply(`Icon downloaded`);
    }
}
