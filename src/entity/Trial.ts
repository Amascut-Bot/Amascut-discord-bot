import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from "typeorm"
import { TrialParticipation } from "./TrialParticipation"

@Entity()
export class Trial {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    trialee: string

    @Column()
    host: string

    @Column()
    role: string

    @Column({ nullable: true })
    link: string

    @CreateDateColumn({ name: 'created_at'})
    createdAt: Date;

    @OneToMany(type => TrialParticipation, participant => participant.trial) participants: TrialParticipation[];
}
