import crypto, {BinaryLike} from "crypto";

export function generateUUID(data: BinaryLike) {
    const sha1sum = crypto.createHash('sha1');
    sha1sum.update(data);
    const s = sha1sum.digest('hex');
    let i = -1;
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c: string) => {
        i += 1;
        switch (c) {
            case 'y':
                return ((parseInt('0x' + s[i], 16) & 0x3) | 0x8).toString(16);
            case 'x':
            default:
                return s[i];
        }
    });
}
