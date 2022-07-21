const Imap = require('imap');

function findAttachmentParts(struct: any, attachments: any) {
  // eslint-disable-next-line no-param-reassign
  attachments = attachments || [];
  for (let index = 0; index < struct.length; index += 1) {
    if (Array.isArray(struct[index])) {
      findAttachmentParts(struct[index], attachments);
    } else if (
      struct[index].disposition &&
      ['INLINE', 'ATTACHMENT'].indexOf(struct[index].disposition.type.toUpperCase()) > -1
    ) {
      attachments.push(struct[index]);
    }
  }
  return attachments;
}

export const searchTaskResult = async (
  imapUser: string,
  imapPassword: string,
  imapHost: string,
  imapPort: number,
  taskID: string
) => {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: imapUser,
      password: imapPassword,
      host: imapHost,
      port: imapPort,
      tls: true,
      tlsOptions: { servername: imapHost }
    });
    const attachmentList: string[] = [];

    // imap connection ready
    imap.once('ready', () => {
      // open INBOX
      // eslint-disable-next-line no-unused-vars
      imap.openBox('INBOX', true, (openBoxErr: any, box: any) => {
        if (openBoxErr) {
          console.error(openBoxErr);
          reject(new Error('Failed to open INBOX'));
        }

        // search email SUBJECT includes taskID
        imap.search([['SUBJECT', taskID.slice(-12)]], (searchErr: any, searchResults: number[]) => {
          if (searchErr) {
            console.error(searchErr);
            reject(new Error('Failed to search email'));
          }

          if (searchResults.length === 0) imap.end();
          else {
            // fetch email headers
            const fetchSearchResults = imap.fetch(searchResults, {
              bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)'],
              struct: true
            });

            // eslint-disable-next-line no-unused-vars
            fetchSearchResults.on('message', (fetchSearchResultMsg: any, fetchSearchResultSeqNo: number) => {
              fetchSearchResultMsg.once('attributes', (attrs: any) => {
                const attachments = findAttachmentParts(attrs.struct, null);

                for (let attachmentIndex = 0; attachmentIndex < attachments.length; attachmentIndex += 1) {
                  const attachment = attachments[attachmentIndex];

                  if (attachment.disposition.params.filename.endsWith('.zip')) {
                    const fetchAttachment = imap.fetch(attrs.uid, { bodies: [attachment.partID], struct: true });

                    // eslint-disable-next-line no-unused-vars
                    fetchAttachment.on('message', (fetchAttachmentMsg: any, fetchAttachmentSeqNo: number) => {
                      // eslint-disable-next-line no-unused-vars
                      fetchAttachmentMsg.on('body', (stream: any, info: any) => {
                        let attachmentChunks = '';

                        stream.on('data', (chunk: any) => {
                          attachmentChunks += chunk.toString('utf8');
                        });

                        stream.once('end', () => {
                          attachmentList.push(attachmentChunks);
                        });
                      });
                    });

                    break;
                  }
                }
              });
            });

            fetchSearchResults.once('error', (fetchErr: any) => {
              console.error(fetchErr);
            });

            fetchSearchResults.once('end', () => {
              imap.end();
            });
          }
        });
      });
    });

    // imap connection error
    imap.once('error', (err: any) => {
      console.error(err);
      reject(new Error('Failed to connect to IMAP server'));
    });

    // imap connection ended
    imap.once('end', () => {
      resolve(attachmentList);
    });

    imap.connect();
  });
};
