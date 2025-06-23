import { Entity, PrimaryGeneratedColumn, Column } from "typeorm"

@Entity()
export class Override {

    @PrimaryGeneratedColumn()
    id: number

    @Column()
    user: string

    @Column()
    feature: string

}
