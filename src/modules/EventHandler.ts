import { readdirSync } from 'fs';
import Bot from '../Bot';
import BotEvent from '../types/BotEvent';
// import BotInteraction from '../types/BotInteraction';

export default interface EventHandler {
    client: Bot;
    built: boolean;
}
export default class EventHandler {
    constructor(client: Bot) {
        this.client = client;
        this.built = false;
        client.on('shardDisconnect', (event, id) => this.client.logger.log({ message: `Shard ${id} Shard Disconnecting`, handler: this.constructor.name }, true));
        client.on('shardResumed', (id, rep) => this.client.logger.log({ message: `Shard ${id} Shard Resume | ${rep} events replayed`, handler: this.constructor.name }, true));
        client.on('shardReady', (id) => this.client.logger.log({ message: `Shard ${id} | Shard Ready`, handler: this.constructor.name, uid: `Internal Cluster` }, true));
    }

    // build() {
    //     if (this.built) return this;
    //     const events = readdirSync(this.client.location + '/src/events');
    //     for (let event of events) {
    //         if (event.endsWith('.ts')) {
    //             import(`${this.client.location}/src/events/${event}`).then((event) => {
    //                 const botEvent: BotEvent = new event.default(this.client);
    //                 this.client.logger.log({ message: `Event '${botEvent.name}' loaded.`, handler: this.constructor.name, uid: `(@${botEvent.uid})` }, false);
    //                 if (botEvent.enabled) {
    //                     const exec = botEvent.exec.bind(botEvent);
    //                     this.client[botEvent.fireOnce ? 'once' : 'on'](botEvent.name, exec);
    //                 }
    //             });
    //         }
    //     }
    //     this.built = true;
    //     return this;
    // }
    async build() {
        if (this.built) return this;
        const eventFiles = readdirSync(`${this.client.location}/src/events`).filter((file) => file.endsWith('.ts'));
        
        for (const file of eventFiles) {
            try {
                const { default: EventClass } = await import(`${this.client.location}/src/events/${file}`);
                const botEvent: BotEvent = new EventClass(this.client);
                
                this.client.logger.log({ message: `Event '${botEvent.name}' loaded.`, handler: this.constructor.name, uid: `(@${botEvent.uid})` }, false);
                
                if (botEvent.enabled) {
                    this.client[botEvent.fireOnce ? 'once' : 'on'](botEvent.name, (...args) => botEvent.exec(args));
                    this.client.logger.log({ message: `Listener attached for event '${botEvent.name}'.`, handler: this.constructor.name }, false);
                }
            } catch (error) {
                this.client.logger.error({ message: `Error loading event from file ${file}`, error });
            }
        }

        this.built = true;
        return this;
    }
}
