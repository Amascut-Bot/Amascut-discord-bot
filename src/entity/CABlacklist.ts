import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class CABlacklist {
    @PrimaryColumn()
    guildId: string;

    @PrimaryColumn()
    userId: string;

    @Column({ type: 'text', nullable: true })
    addedBy: string | null = null;
}
