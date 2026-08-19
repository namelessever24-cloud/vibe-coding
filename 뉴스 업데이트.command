#!/bin/zsh
cd "${0:A:h}" || exit 1
python3 update_news.py
echo ""
echo "완료되었습니다. 이 창을 닫아도 됩니다."
read "?엔터 키를 누르면 창이 닫힙니다. "
