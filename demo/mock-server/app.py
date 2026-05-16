# Bob's submission — intentionally broken for demo purposes:
#   * POST /businesses with invalid body returns 200 (should be 400) — breaks Rubric 6
#   * DELETE /businesses/<id> returns 200 instead of 204            — breaks Rubric 4

from flask import Flask, request, jsonify, abort

app = Flask(__name__)

businesses = {}
next_id = 1


def _create(name, address):
    global next_id
    biz = {"id": next_id, "name": name, "address": address}
    businesses[next_id] = biz
    next_id += 1
    return biz


def _seed():
    _create("Joe's Coffee", "123 Main St, Corvallis, OR")
    _create("Beaver Burgers", "456 Monroe Ave, Corvallis, OR")
    _create("Pixel Bookstore", "789 Jackson St, Corvallis, OR")
    _create("Riverside Diner", "12 Riverfront Dr, Corvallis, OR")
    _create("Cloud Nine Bakery", "9 Cloud Ln, Corvallis, OR")


@app.route("/businesses", methods=["POST"])
def create_business():
    data = request.get_json(silent=True)

    # BUG: Bob forgot to validate the body. Any invalid body still produces
    # a 200 with a placeholder business instead of a proper 400.
    if not isinstance(data, dict):
        data = {}
    name = data.get("name") or "untitled"
    address = data.get("address") or "unknown"

    biz = _create(name, address)
    return jsonify(biz), 200  # BUG: should be 201 on success too,
                              #      but the critical break is the 200-on-bad-body path.


@app.route("/businesses", methods=["GET"])
def list_businesses():
    try:
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 3))
    except ValueError:
        return jsonify({"error": "page and limit must be integers"}), 400

    if page < 1 or limit < 1:
        return jsonify({"error": "page and limit must be positive integers"}), 400

    all_items = sorted(businesses.values(), key=lambda b: b["id"])
    total = len(all_items)
    start = (page - 1) * limit
    end = start + limit
    page_items = all_items[start:end]

    next_link = None
    if end < total:
        next_link = f"?page={page + 1}&limit={limit}"

    return jsonify({"businesses": page_items, "next": next_link, "total": total}), 200


@app.route("/businesses/<int:biz_id>", methods=["GET"])
def get_business(biz_id):
    biz = businesses.get(biz_id)
    if not biz:
        return jsonify({"error": f"Business {biz_id} not found"}), 404
    return jsonify(biz), 200


@app.route("/businesses/<int:biz_id>", methods=["DELETE"])
def delete_business(biz_id):
    if biz_id not in businesses:
        return jsonify({"error": f"Business {biz_id} not found"}), 404
    del businesses[biz_id]
    # BUG: Bob returns 200 with a message instead of the correct 204 No Content.
    return jsonify({"message": "deleted"}), 200


@app.errorhandler(404)
def not_found(_e):
    return jsonify({"error": "Resource not found"}), 404


_seed()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)
