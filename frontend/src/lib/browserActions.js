export function downloadBlobFile(blobData, fileName) {
    const blob = blobData instanceof Blob ? blobData : new Blob([blobData]);
    const objectUrl = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.setAttribute('download', fileName);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    URL.revokeObjectURL(objectUrl);
}

export function printHtmlDocument(htmlContent, features = 'width=900,height=700') {
    const printWindow = window.open('', '_blank', features);
    if (!printWindow) {
        throw new Error('Print window could not be opened');
    }

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
        printWindow.print();
    }, 250);
}
