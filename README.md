Код для вставки на сайте чтобы использовать плеер как iframe

```
<div id="NW15pleer-container" style="width: 100%"></div>
<script>
  window.onload = function() {
    console.log('Page fully loaded, adding iframe');

    const iframe = document.createElement('iframe');
    iframe.id = 'NW15pleer';
    iframe.src = 'https://demo.parsley.digital/glukofon/';
    iframe.style.width = '100%';
    iframe.style.border = 'none';

    const container = document.getElementById('NW15pleer-container');
    if (container) {
      container.appendChild(iframe);
      window.addEventListener('message', (event) => {
        console.log('addEventListener', event.data);
        if (event.data.type === 'resize' && event.data.height) {
          console.log('iframeHeight', event.data.height);
          document.getElementById('NW15pleer').style.height = event.data.height + 'px';
        }
      });
    } else {
      console.error('Container not found');
    }
  };
</script>
```
