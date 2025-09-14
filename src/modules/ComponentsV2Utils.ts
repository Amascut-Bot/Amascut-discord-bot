import { ContainerBuilder, Message, MessageFlags, SeparatorSpacingSize } from "discord.js";
import Bot from "../Bot";

export default interface ComponentsV2Utils {
    client: Bot;
}

export default class ComponentsV2Utils {
    constructor(client: Bot) {
        this.client = client;
    }

    //cleans up a componentsV2-container
    public static cleanContainer(containerData: any, disableControls: boolean = false) :any {
        const newContainer: any = {};

        if (containerData.type) newContainer.type = containerData.type;
        if (containerData.accentColor) newContainer.accent_color = containerData.accentColor;

        if (containerData.components?.length > 0) {
            //depending on component type...
            newContainer.components = containerData.components.map((component: any) => {
                return this.cleanComponent(component, disableControls);
            });
        }

        return newContainer;
    }

    private static cleanComponent(node: any, disableControls: boolean = false) :any {
        let result: any = {};

        //ActionRow
        if (node.type == 1) {
            result = {
                type: node.type
            };

            result.components = node.components.map((component: any) => {
                return this.cleanComponent(component, disableControls);
            });
        }

        //Button
        if (node.type == 2) {
            result = {
                type: node.type,
                style: node.style,
                custom_id: node.customId,
                disabled: disableControls
            };

            if (node.label) result.label = node.label;
            if (node.emoji) result.emoji = node.emoji;
            if (node.url) result.url = node.url;
        }

        //String Select
        if (node.type == 3) {
            result = {
                type: node.type,
                custom_id: node.customId,
                disabled: disableControls
            };

            if (node.placeholder) result.placeholder = node.placeholder;
            if (node.minValues) result.min_values = node.minValues;
            if (node.maxValues) result.max_values = node.maxValues;

            result.options = node.options.map((option: any) => {
                let optionResult: any = {};

                if (option.label) optionResult.label = option.label;
                if (option.value) optionResult.value = option.value;
                if (option.description) optionResult.description = option.description;

                if (option.emoji) {
                    const emoji: any = {};

                    if (option.emoji.name) emoji.name = option.emoji.name;
                    if (option.emoji.id) emoji.id = option.emoji.id;
                    if (option.emoji.animated) emoji.animated = option.emoji.animated;

                    optionResult.emoji = emoji;
                }

                return optionResult;
            });
        }

        //User Select
        if (node.type == 5) {
            result = {
                type: node.type,
                custom_id: node.customId,
                disabled: disableControls
            };

            if (node.placeholder) result.placeholder = node.placeholder;
            if (node.minValues) result.min_values = node.minValues;
            if (node.maxValues) result.max_values = node.maxValues;
        }

        //Section
        if (node.type == 9) {
            result = {
                type: node.type
            };

            result.components = node.components.map((component: any) => {
                return this.cleanComponent(component, disableControls);
            });

            result.accessory = this.cleanComponent(node.accessory, disableControls);
        }

        //Text Display
        if (node.type == 10) {
            result = {
                type: node.type,
                content: node.content
            };
        }

        //Thumbnail
        if (node.type == 11) {
            result = {
                type: node.type,
                media: {
                    url: node.media.url
                }
            };

            if (node.description) result.description = node.description;
        }

        //Media Gallery
        if (node.type == 12) {
            result = {
                type: node.type
            };

            result.items = node.items.map((item: any) => {
                let itemResult: any = {};

                itemResult.media = {
                    url: item.media.url
                };

                if (item.description) itemResult.description = item.description;

                return itemResult;
            });
        }

        //Separator
        if (node.type == 14) {
            result = {
                type: node.type,
                spacing: node.spacing
            };
        }

        //Container
        if (node.type == 17) {
            result = {
                type: node.type
            };

            if (node.accentColor) result.accent_color = node.accentColor;

            result.components = node.components.map((component: any) => {
                return this.cleanComponent(component, disableControls);
            });
        }

        return result;
    }

    public static async disableControls(message: Message): Promise<void> {
        if (message.flags.has(MessageFlags.IsComponentsV2)) {
            const components = message.components;
            const newComponents = [];

            for (const container of components) {
                newComponents.push(this.cleanContainer(container, true));
            }

            await message.edit({
                content: message.content,
                components: newComponents,
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { "parse": [] }
            });
        }
    }

    //#region Builders

    public getContainerBuilder(success: boolean | null, title: string) : ContainerBuilder {
        const container = new ContainerBuilder();

        if (success === true) container.setAccentColor(this.client.util.colours.green).addTextDisplayComponents(builder => builder.setContent(`${title}`)).addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));
        if (success === false) container.setAccentColor(this.client.util.colours.red).addTextDisplayComponents(builder => builder.setContent(`${title}`)).addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));
        if (success === null) container.setAccentColor(this.client.color).addTextDisplayComponents(builder => builder.setContent(`${title}`)).addSeparatorComponents(separator => separator.setSpacing(SeparatorSpacingSize.Small));

        return container;
    }

    //#endregion
}
