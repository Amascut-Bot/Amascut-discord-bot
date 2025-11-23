import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm"

@Entity()
export class HostParticipation {

    @PrimaryGeneratedColumn()
    id: number

    // 0 = learner-hour, 1 = lorebook-kill, 2 = trial-hour
    @Column()
    type: number

    // user who participated
    @Column()
    user: string

    // did they host? 0 = no, 1 = yes
    @Column()
    host: number

    // did they participate? 0 = no, 1 = yes
    @Column({ default: 1})
    participate: number

    // link to host message, if host came through a card
    @Column({ nullable: true })
    link: string

    @CreateDateColumn({ name: 'created_at'})
    createdAt: Date;
}
