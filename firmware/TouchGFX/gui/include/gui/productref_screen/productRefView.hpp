#ifndef PRODUCTREFVIEW_HPP
#define PRODUCTREFVIEW_HPP

#include <gui_generated/productref_screen/productRefViewBase.hpp>
#include <gui/productref_screen/productRefPresenter.hpp>

class productRefView : public productRefViewBase
{
public:
    productRefView();
    virtual ~productRefView() {}
    virtual void setupScreen();
    virtual void tearDownScreen();
protected:
};

#endif // PRODUCTREFVIEW_HPP
